"use client";

import { useState, useEffect } from "react";
import { me } from "@/lib/citizens";
import { act } from "@/lib/actionClient";

/* Pure nonsense filler blocks. No function. Maximum chaos. (peak3/4/5) */

export function WelcomeTitle() {
  const title = "UNITED MEMEOSTAN";
  return (
    <div style={{ maxWidth: "none", margin: "8px 0", padding: "0 16px" }}>
      <div className="pixel" style={{ color: "#fff", fontSize: 16 }}>v69420.0.0 (brainrot edition)</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 60 }}>🐸</span>
        <div className="bubble" style={{ alignSelf: "flex-start" }}>i am the law now 👑</div>
        <h1 className="megatitle">
          {title.split("").map((c, i) => (
            <span key={i}>{c === " " ? " " : c}</span>
          ))}
        </h1>
        <span style={{ fontSize: 40 }}>🚩</span>
      </div>
      <p className="comic" style={{ textAlign: "center", fontSize: 22, color: "#fff", marginTop: 4 }}>
        THE ONLY COUNTRY THAT DOESN&apos;T EXIST <span className="hl">(AND PROUD OF IT)</span>
      </p>
    </div>
  );
}

export function NavTabs() {
  const tabs = [
    ["HOME?", "b-cyan"], ["GOVERNMENT??", "b-lime"], ["MEME ELECTIONS!!!", "b-pink"],
    ["$MEMECOIN", "b-yellow"], ["CITIES (WIP LOL)", "b-orange"], ["MEME WARS", "b-purple"],
    ["STORE (BUY AIR)", "b-cyan"], ["MORE STUFF", "b-note"],
  ];
  return (
    <div className="navtabs">
      {tabs.map(([t, c]) => (
        <span key={t} className={`tab ${c}`}>{t}</span>
      ))}
    </div>
  );
}

export function SignIn() {
  return (
    <div className="blk b-dark">
      <span className="blk-title" style={{ color: "var(--lime)" }}>🔑 SIGN IN WITH</span>
      <div className="comic" style={{ fontSize: 18, lineHeight: 1.5 }}>
        <div style={{ color: "var(--red)" }}>GOOGLE (EW)</div>
        <div style={{ color: "var(--blue)" }}>DISCORD (BETTER)</div>
        <div style={{ color: "var(--lime)" }}>WALLET (BESTER)</div>
      </div>
    </div>
  );
}

export function MemecoinPrice() {
  return (
    <div className="blk b-yellow">
      <span className="blk-title">💰 MEMECOIN PRICE</span>
      <p className="marker" style={{ fontSize: 17 }}>1 MMC = 0.42069 lol</p>
      <p className="comic" style={{ fontSize: 22, color: "var(--green)" }}>↑ +69.69%</p>
      <p className="hand" style={{ fontSize: 14 }}>(why not?)</p>
    </div>
  );
}

export function President() {
  return (
    <div className="blk b-paper tape t-pink">
      <span className="blk-title" style={{ color: "#181018" }}>🎖️ PRESIDENT (FOR NOW)</span>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 38 }}>🐸</span>
        <div className="hand" style={{ fontSize: 16 }}>
          <b>@SigmaAlpha69420</b><br />SUPREME SHITPOSTER<br />elected by memes (obviously)
        </div>
      </div>
      <button className="btn purple" style={{ width: "100%", marginTop: 8 }}>WORSHIP LEADER</button>
    </div>
  );
}

export function RizzLevel() {
  return (
    <div className="blk b-cyan" style={{ textAlign: "center" }}>
      <span className="blk-title">😤 RIZZ LEVEL</span>
      <p className="comic" style={{ fontSize: 40 }}>99999</p>
      <p className="hand" style={{ fontSize: 16 }}>MAX 🤪</p>
    </div>
  );
}

export function CitizenRights() {
  return (
    <div className="blk b-yellow pin">
      <span className="blk-title">📜 CITIZEN RIGHTS (real)</span>
      <ol className="hand" style={{ fontSize: 16, paddingLeft: 20, lineHeight: 1.5 }}>
        <li>Free WiFi</li><li>Nap anytime</li><li>Post cringe</li>
        <li>No consequences</li><li>Be dumb</li><li>IDK anymore 🙂</li>
      </ol>
    </div>
  );
}

export function ThingsToDo() {
  const items = ["📱 Doomscroll", "🎮 Meme Games", "🟩 Buy Virtual Land", "🎉 Nonsense Events", "🤖 Talk to AI Minister", "🧾 Commit Tax Evasion"];
  return (
    <div className="blk b-paper">
      <span className="blk-title" style={{ color: "#181018" }}>📋 THINGS TO DO (maybe)</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((x) => <span key={x} className="sticker s-cyan">{x}</span>)}
      </div>
    </div>
  );
}

export function AIMinister() {
  return (
    <div className="blk b-yellow">
      <span className="blk-title">🤖 AI MINISTER SAYS:</span>
      <p className="hand" style={{ fontSize: 19 }}>“all your problems are a skill issue.”</p>
    </div>
  );
}

export function YouAreNothing() {
  return (
    <div className="blk b-pink" style={{ textAlign: "center" }}>
      <p className="comic" style={{ fontSize: 26, color: "#fff" }}>YOU ARE NOTHING</p>
      <p className="comic" style={{ fontSize: 22, color: "var(--yellow)" }}>BUT STILL SPECIAL 💖</p>
    </div>
  );
}

export function BrainrotFM() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [progress, setProgress] = useState(35);
  const [volume, setVolume] = useState(80);
  
  const tracks = [
    { title: "SKIBIDI TOILET PHONK (REMIX)", artist: "DJ RIZZLER" },
    { title: "SIGMA CHAD MEWING MASHUP", artist: "LIL MUTE" },
    { title: "GRIMACE SHAKE GYATT BEAT", artist: "MC OHIO" },
    { title: "WINDING DOWN IN NAPISTAN", artist: "Lofi Cat" }
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 1));
    }, 400);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const currentTrack = tracks[trackIndex];

  return (
    <div className="blk b-dark paper-clip" style={{ padding: 18, border: "3px solid #333", background: "#05020c", position: "relative", overflow: "hidden" }}>
      {/* CRT Screen Overlays */}
      <div className="crt-glow" style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "radial-gradient(circle, transparent 65%, rgba(0, 240, 255, 0.15))",
        pointerEvents: "none", zIndex: 2
      }} />
      <div className="crt-scanlines" style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.05))",
        backgroundSize: "100% 4px, 6px 100%",
        pointerEvents: "none", zIndex: 2
      }} />

      <span className="pixel" style={{ color: "var(--pink)", fontSize: 10, display: "block", marginBottom: 8, letterSpacing: 1 }}>
        📻 CRT-9000 PHONK PLAYER
      </span>

      {/* Screen Monitor */}
      <div style={{ background: "#0c061a", border: "2px solid #00f0ff", borderRadius: 4, padding: 10, marginBottom: 12, boxShadow: "0 0 10px rgba(0,240,255,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span className="pixel blink" style={{ fontSize: 9, color: isPlaying ? "var(--lime)" : "var(--bad)" }}>
            ● {isPlaying ? "PLAYING" : "PAUSED"}
          </span>
          <span className="pixel" style={{ fontSize: 9, color: "var(--cyan)" }}>
            VOL: {volume}%
          </span>
        </div>

        <div className="pixel" style={{ fontSize: 11, color: "var(--yellow)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {currentTrack.title}
        </div>
        <div className="hand" style={{ fontSize: 13, color: "var(--bone-soft)" }}>
          by {currentTrack.artist}
        </div>

        {/* Audio Visualizer Bars */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 24, marginTop: 8 }}>
          {Array.from({ length: 18 }).map((_, i) => {
            const height = isPlaying ? Math.floor(Math.random() * 20) + 4 : 4;
            return (
              <div key={i} style={{
                flex: 1,
                height: `${height}px`,
                background: `linear-gradient(to top, var(--purple), var(--cyan))`,
                transition: "height 0.15s ease"
              }} />
            );
          })}
        </div>

        {/* Progress Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span className="pixel" style={{ fontSize: 8, color: "var(--bone-soft)" }}>
            {Math.floor(progress / 20)}:{String(progress % 20).padStart(2, "0")}
          </span>
          <div className="bar" style={{ flex: 1, height: 6, margin: 0, background: "rgba(255,255,255,0.1)", borderColor: "var(--ink)" }}>
            <i style={{ width: `${progress}%`, background: "var(--cyan)" }} />
          </div>
          <span className="pixel" style={{ fontSize: 8, color: "var(--bone-soft)" }}>5:00</span>
        </div>
      </div>

      {/* Hardware buttons */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className={`btn sm ${isPlaying ? "pink" : "lime"}`} style={{ flex: 1, padding: 6, fontSize: 11 }} onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? "PAUSE ⏸" : "PLAY ▶️"}
        </button>
        <button className="btn sm yellow" style={{ flex: 1, padding: 6, fontSize: 11 }} onClick={() => {
          setTrackIndex((i) => (i + 1) % tracks.length);
          setProgress(0);
        }}>
          NEXT ⏭
        </button>
      </div>
    </div>
  );
}

export function QuickNap() {
  const [isNapping, setIsNapping] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [auraEarned, setAuraEarned] = useState(false);
  const citizen = me();

  const handleNap = () => {
    if (!citizen || isNapping) return;
    setIsNapping(true);
    setCountdown(10);
    setAuraEarned(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsNapping(false);
          act("nap.complete");
          setAuraEarned(true);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("nation-update"));
          }
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="blk b-lime pin-center" style={{ background: "var(--lime)", color: "#070a04", padding: 18 }}>
      <span className="blk-title">😴 QUICK NAP WIDGET</span>
      <p className="hand" style={{ fontSize: 15, marginBottom: 8 }}>
        Boost your Aura (+10) by taking a quick 10s power nap in Ohio.
      </p>

      {isNapping ? (
        <div style={{ textAlign: "center", padding: 10, background: "rgba(0,0,0,0.06)", borderRadius: 6, border: "2.5px dashed #000" }}>
          <div className="pixel blink" style={{ fontSize: 18, margin: "6px 0", color: "var(--purple)" }}>
            🐱 zzz... ({countdown}s)
          </div>
          <div className="bar" style={{ height: 10, background: "rgba(0,0,0,0.1)", borderColor: "#000" }}>
            <i style={{ width: `${(10 - countdown) * 10}%`, background: "var(--purple)" }} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn purple" style={{ width: "100%" }} onClick={handleNap} disabled={!citizen}>
            {citizen ? "TAKE A QUICK NAP 🛌" : "REGISTER TO NAP"}
          </button>
          {auraEarned && (
            <p className="marker" style={{ fontSize: 13, color: "var(--pink)", textAlign: "center", animation: "blink 1s ease infinite" }}>
              ✨ NAP SUCCESSFUL! +10 AURA! ✨
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function RandomGenerator() {
  return (
    <div className="blk b-dark">
      <span className="blk-title" style={{ color: "var(--cyan)" }}>🎲 RANDOM BRAINROT GENERATOR</span>
      <button className="btn cyan" style={{ width: "100%" }}>GENERATE</button>
      <p className="hand" style={{ fontSize: 16, marginTop: 6, color: "var(--lime)" }}>✨ Skibidi + Rizz + Sigma = ???</p>
    </div>
  );
}

export function Partners() {
  const p = [["🥤", "Skibidi Energy"], ["✈️", "RIZZ Airlines"], ["🏋️", "OMEGA Gym"], ["💊", "DOPAMINE Supplements"]];
  return (
    <div className="partners">
      <span className="comic" style={{ fontSize: 18 }}>VISIT OUR PARTNERS (why?)</span>
      {p.map(([e, n]) => (
        <span key={n} className="hand" style={{ fontSize: 17 }}>{e} {n}</span>
      ))}
      <span className="comic blink" style={{ fontSize: 18, color: "#c0392b" }}>SCROLL DOWN? → THERE IS MORE (maybe)</span>
    </div>
  );
}

export function DailyReminder() {
  return (
    <div className="blk b-note pin">
      <span className="blk-title">📝 DAILY REMINDER</span>
      <ul className="hand" style={{ fontSize: 17, paddingLeft: 18, lineHeight: 1.5 }}>
        <li>drink water (maybe)</li>
        <li>touch grass (optional)</li>
        <li>scroll 24/7 (mandatory)</li>
      </ul>
    </div>
  );
}

export function NationalHoliday() {
  return (
    <div className="blk b-cyan">
      <span className="blk-title">🎉 TODAY&apos;S NATIONAL HOLIDAY</span>
      <p className="marker" style={{ fontSize: 20 }}>International Nap Day 😴💤</p>
      <p className="hand" style={{ fontSize: 15 }}>(every day is nap day if u believe)</p>
    </div>
  );
}

export function RandomStuff() {
  return (
    <div className="blk b-kraft">
      <span className="blk-title">🥔 RANDOM STUFF</span>
      <p style={{ fontSize: 40, textAlign: "center" }}>🥔</p>
      <p className="hand" style={{ fontSize: 16, textAlign: "center" }}>potato. that&apos;s it. that&apos;s the block.</p>
    </div>
  );
}

export function VibeOfNation() {
  return (
    <div className="blk b-dark">
      <span className="blk-title" style={{ color: "var(--cyan)" }}>📈 VIBE OF THE NATION</span>
      <p className="comic" style={{ fontSize: 26, color: "var(--lime)" }}>CONFUSED BUT HAPPY</p>
      <div className="bar" style={{ marginTop: 6 }}><i style={{ width: "73%", background: "var(--cyan)" }} /></div>
    </div>
  );
}

export function HowBuilt() {
  return (
    <div className="blk b-yellow">
      <span className="blk-title">🛠️ HOW MEMEOSTAN WAS BUILT (not true)</span>
      <p className="hand" style={{ fontSize: 17, lineHeight: 1.6 }}>
        some guy ➡️ had a meme ➡️ posted it ➡️ 8️⃣8️⃣8️⃣ ➡️ became a country ➡️ profit??? 💰
      </p>
    </div>
  );
}

export function MemeIsLove() {
  return (
    <div className="blk b-pink" style={{ textAlign: "center" }}>
      <p className="comic" style={{ fontSize: 30, color: "#fff" }}>MEME IS LOVE</p>
      <p className="comic" style={{ fontSize: 30, color: "var(--yellow)" }}>MEME IS LIFE</p>
    </div>
  );
}

export function UpgradeBrainrot() {
  return (
    <div className="blk b-lime">
      <span className="blk-title">⬆️ UPGRADE YOUR BRAINROT</span>
      {["+10 IQ (fake)", "remove 1 brain cell", "infinite scroll DLC"].map((x) => (
        <div key={x} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "5px 0" }}>
          <span className="hand" style={{ fontSize: 16 }}>{x}</span>
          <button className="btn cyan" style={{ fontSize: 13, padding: "3px 9px" }}>BUY</button>
        </div>
      ))}
    </div>
  );
}

export function BreakingNews() {
  return (
    <div className="blk b-paper tape t-pink">
      <span className="blk-title" style={{ color: "#c0392b" }}>📰 BREAKING (maybe fake) NEWS</span>
      <p className="marker" style={{ fontSize: 16 }}>SCIENTISTS SAY MEMES ARE NOW THE NEW OXYGEN 🫁</p>
      <p className="hand" style={{ fontSize: 14, marginTop: 4 }}>more at 11 (we won&apos;t)</p>
    </div>
  );
}

export function Weather() {
  return (
    <div className="blk b-blue">
      <span className="blk-title">🌦️ WEATHER (not accurate)</span>
      <p className="comic" style={{ fontSize: 32, color: "var(--yellow)" }}>69°C</p>
      <p className="hand" style={{ fontSize: 16 }}>feels like: stock 🥶 brrr</p>
    </div>
  );
}

export function TodaysMood() {
  return (
    <div className="blk b-yellow">
      <span className="blk-title">🎭 TODAY&apos;S MOOD</span>
      <p style={{ fontSize: 30, letterSpacing: 4 }}>😀😐😭🗿💀🤡</p>
    </div>
  );
}

export function AIAdvisor() {
  return (
    <div className="blk b-dark">
      <span className="blk-title" style={{ color: "var(--purple)" }}>🤖 AI ADVISOR (always right)</span>
      <p className="pixel" style={{ fontSize: 18, color: "var(--lime)", lineHeight: 1.4 }}>
        &gt; ANALYZING...<br />&gt; THINKING...<br />&gt; CONCLUSION: <b>idk</b> 🤷
      </p>
    </div>
  );
}

export function ToDoList() {
  const items = ["make up (cope)", "eat food (maybe)", "scroll memes", "world domination"];
  return (
    <div className="blk b-paper pin">
      <span className="blk-title" style={{ color: "#181018" }}>✅ TODAY&apos;S TO-DO</span>
      {items.map((x, i) => (
        <label key={x} className="hand" style={{ display: "flex", gap: 6, fontSize: 16, alignItems: "center" }}>
          <input type="checkbox" defaultChecked={i < 2} style={{ width: "auto" }} /> {x}
        </label>
      ))}
    </div>
  );
}

export function PanicButton() {
  const [cooked, setCooked] = useState(false);
  return (
    <div className="blk b-red" style={{ textAlign: "center" }}>
      <span className="blk-title">🚨 PANIC BUTTON</span>
      <button className="btn yellow" style={{ fontSize: 22 }} onClick={() => setCooked((c) => !c)}>
        {cooked ? "TOO LATE 💀" : "PRESS IF COOKED"}
      </button>
      {cooked && <p className="hand blink" style={{ fontSize: 16, marginTop: 6, color: "#fff" }}>nothing happened. as expected.</p>}
    </div>
  );
}

export function DoNotPress() {
  const [pressed, setPressed] = useState(0);
  return (
    <div className="blk b-dark" style={{ textAlign: "center" }}>
      <span className="blk-title" style={{ color: "var(--red)" }}>⛔ DO NOT PRESS</span>
      <button className="btn red" style={{ fontSize: 22 }} onClick={() => setPressed((p) => p + 1)}>
        DO NOT PRESS
      </button>
      {pressed > 0 && (
        <p className="hand" style={{ fontSize: 15, marginTop: 6, color: "var(--lime)" }}>
          u pressed it {pressed}× . the government has been notified.
        </p>
      )}
    </div>
  );
}

export function MapOfMemeostan() {
  return (
    <div className="blk b-paper tape t-cyan">
      <span className="blk-title" style={{ color: "#181018" }}>🗺️ MAP OF MEMEOSTAN (real)</span>
      <div className="hand" style={{ fontSize: 16, lineHeight: 1.7 }}>
        🏙️ Brainrot City &nbsp; 🐮 Ohio (the bad place)<br />
        😏 Rizzland &nbsp; 😴 Napistan<br />
        🥶 Sigma Tundra &nbsp; 🏜️ Cringe Desert<br />
        🌊 sus sea (do not swim)
      </div>
    </div>
  );
}

export function LifeIsSoup() {
  return (
    <div className="blk b-orange" style={{ textAlign: "center" }}>
      <p className="comic" style={{ fontSize: 26 }}>life is soup</p>
      <p className="comic" style={{ fontSize: 26, color: "#fff" }}>i am fork 🍴</p>
    </div>
  );
}

export function AreYouHuman() {
  const [no, setNo] = useState(0);
  return (
    <div className="blk b-cyan">
      <span className="blk-title">🤔 ARE YOU HUMAN?</span>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button className="btn" onClick={() => setNo((n) => n + 1)}>NO</button>
        <button className="btn" onClick={() => setNo((n) => n + 1)}>NO</button>
      </div>
      {no > 0 && <p className="hand" style={{ fontSize: 15, marginTop: 6 }}>verified ✅ welcome, NPC.</p>}
    </div>
  );
}

export function LeaveMessage() {
  return (
    <div className="blk b-note">
      <span className="blk-title">💌 MESSAGE FOR FUTURE CITIZENS</span>
      <p className="hand" style={{ fontSize: 17 }}>“be kind or be funny. ideally both.”</p>
      <input placeholder="leave a msg (goes nowhere)" style={{ marginTop: 6 }} />
    </div>
  );
}

export function EarthIsMid() {
  return (
    <div className="blk b-dark" style={{ textAlign: "center" }}>
      <p style={{ fontSize: 38 }}>🌍</p>
      <p className="hand" style={{ fontSize: 16, color: "var(--cyan)" }}>earth is mid.</p>
      <p className="hand" style={{ fontSize: 14, color: "var(--lime)" }}>research flat earth → or is it donut? 🍩</p>
    </div>
  );
}

export function ScrollIfYouDare() {
  return (
    <div className="blk b-pink" style={{ textAlign: "center" }}>
      <p className="comic blink" style={{ fontSize: 26, color: "var(--yellow)" }}>SCROLL DOWN</p>
      <p className="comic" style={{ fontSize: 26, color: "#fff" }}>IF YOU DARE 👀</p>
    </div>
  );
}
