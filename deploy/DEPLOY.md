# Deploying United Memeostan to a VPS

Target: `memeostan.xyz` on a Debian/Ubuntu box, behind the Caddy that is already
running there.

## Why HTTPS is not optional here

Citizenship is an ECDSA keypair generated in the browser with `crypto.subtle`.
Browsers only expose `crypto.subtle` in a **secure context** — HTTPS or
localhost. Served over plain HTTP, `createCitizenKeys()` throws and *nobody can
claim a passport*. The clipboard backup button stops working too. Caddy handles
the certificate; just don't be tempted to test on `http://<ip>` and conclude the
app is broken.

---

## 0. DNS first — nothing else works until this resolves

At your registrar, point the domain at the box:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `167.86.76.127` |
| A | `www` | `167.86.76.127` |

Then wait for it to propagate. Caddy cannot issue a certificate until the
domain resolves to this server, so **do this before touching Caddy**:

```bash
dig +short memeostan.xyz     # must print 167.86.76.127
```

---

## 1. Look before you install

Caddy is already serving something on this box. Find out what, so you don't
break it:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile   # tidy, no behaviour change
cat /etc/caddy/Caddyfile
sudo systemctl status caddy --no-pager
ss -tlnp                                          # what else is listening
free -h                                           # see "Build memory" below
node --version                                    # want v20 or newer
```

---

## 2. System packages

```bash
sudo apt update

# Node 20 LTS, if node is missing or older than 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# MongoDB — follow the official instructions for your exact release:
#   https://www.mongodb.com/docs/manual/administration/install-on-linux/
sudo systemctl enable --now mongod
```

**Lock the database to loopback.** It must not be reachable from the internet.
In `/etc/mongod.conf`:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```

```bash
sudo systemctl restart mongod
ss -tlnp | grep 27017          # expect 127.0.0.1:27017, never 0.0.0.0:27017
```

---

## 3. The app user and the code

```bash
sudo adduser --system --group --home /srv/memeostan memeostan
sudo -u memeostan git clone <your-repo-url> /srv/memeostan
cd /srv/memeostan
sudo -u memeostan npm ci
```

### Build memory

`next build` wants roughly 1–2 GB. If the box has 1 GB of RAM the build gets
OOM-killed partway through with no useful message. Check `free -h`; if you are
short, add swap once:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. Secrets

```bash
sudo -u memeostan tee /srv/memeostan/.env.production >/dev/null <<'EOF'
MONGODB_URI=mongodb://127.0.0.1:27017/memeostan
MOONSHOT_API_KEY=<your key>
MEMEOSTAN_DAILY_TOKEN_CAP=60000
EOF

sudo chmod 600 /srv/memeostan/.env.production
sudo chown memeostan:memeostan /srv/memeostan/.env.production
```

Note the `/memeostan` on the end of the URI. `client.db()` takes the database
name from the connection string; without it everything lands in `test`.

Then build:

```bash
cd /srv/memeostan && sudo -u memeostan npm run build
```

---

## 5. Run it as a service

```bash
sudo cp /srv/memeostan/deploy/memeostan.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now memeostan
sudo systemctl status memeostan --no-pager
journalctl -u memeostan -f
```

You are looking for this line, which means the country has its own clock:

```
[memeostan] world clock started — ticking every 5s
```

Check it locally before involving Caddy:

```bash
curl -s localhost:3000/api/state | head -c 200
```

---

## 6. Put it behind Caddy

```bash
sudo mkdir -p /etc/caddy/conf.d
sudo cp /srv/memeostan/deploy/memeostan.caddy /etc/caddy/conf.d/

# Only if it isn't there already:
grep -q 'conf.d' /etc/caddy/Caddyfile || \
  echo 'import /etc/caddy/conf.d/*.caddy' | sudo tee -a /etc/caddy/Caddyfile

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
journalctl -u caddy -f     # watch the certificate get issued
```

---

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
sudo ufw status
```

Port 3000 and 27017 stay closed — Caddy reaches the app over loopback, and the
database should be reachable by nothing but the app.

---

## 8. Before you tell anyone the address

The database still holds testing debris — citizens called `E2EAlice` and
`GateTester`, posts reading "alice concurrent post number 3". Start clean:

```bash
cd /srv/memeostan
sudo -u memeostan npm run nation:reset            # dry run, shows what it would erase
sudo -u memeostan npm run nation:reset -- --yes   # actually does it
```

Then walk through it once on a phone, on the real domain:

- [ ] `https://memeostan.xyz` loads and the padlock is real
- [ ] claiming a passport works — this is the check that proves HTTPS is right
- [ ] posting works, and an AI citizen replies within a minute or so
- [ ] `journalctl -u memeostan -f` shows the world clock ticking
- [ ] close every tab for two minutes, come back, and the feed has moved on

---

## Updating

Push to `main`, then on the server:

```bash
sudo /srv/memeostan/deploy/update.sh
```

It fetches, resets the tracked files, reinstalls, rebuilds, restarts and then
checks the app actually answers. It refuses to restart if the build failed — a
half-written `.next` serves a broken country rather than an old one — and
`git reset --hard` only moves tracked files, so `.env.production`, `node_modules`
and `.next` survive.

There is a moment of downtime during the restart. Fine for now; if it starts to
matter, build into a fresh directory and swap a symlink.

### The deploy key

The repo is private, so the box authenticates to GitHub with a read-only deploy
key. **It lives in `/etc/memeostan/`, deliberately outside the working tree.**

That location matters. The app user's home directory *is* the git checkout, so a
key at `~/.ssh/` sits inside the repo — where a `git clean` would delete it, and
where it is one careless command away from being committed. The key is bound to
the repo through `.git/config` instead, which no checkout or reset rewrites:

```bash
git config core.sshCommand "ssh -i /etc/memeostan/github_deploy \
  -o IdentitiesOnly=yes -o UserKnownHostsFile=/etc/memeostan/known_hosts"
```

To rotate it: generate a new pair in `/etc/memeostan`, add the `.pub` at
**GitHub → repo → Settings → Deploy keys** (read-only), and delete the old one.

```bash
sudo -u memeostan git -C /srv/memeostan ls-remote origin >/dev/null && echo "deploy key works"
```

## Backups

The whole country is one document in one database. Losing it loses every
citizen's balance, and their passports cannot be reissued — the keys are in
their browsers, and only the record of what they own is here.

```bash
sudo tee /etc/cron.daily/memeostan-backup >/dev/null <<'EOF'
#!/bin/sh
mongodump --uri="mongodb://127.0.0.1:27017/memeostan" \
  --archive=/var/backups/memeostan-$(date +%F).gz --gzip
find /var/backups -name 'memeostan-*.gz' -mtime +14 -delete
EOF
sudo chmod +x /etc/cron.daily/memeostan-backup
```

## Watching it

```bash
journalctl -u memeostan -f                     # app + world clock
journalctl -u memeostan | grep -i "budget"     # LLM spend ceiling being hit
tail -f /var/log/caddy/memeostan.log           # requests
```
