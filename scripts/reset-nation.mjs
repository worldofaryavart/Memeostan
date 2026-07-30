// Wipes the nation and lets it re-seed from scratch on the next page load.
//
// Use before a launch, or after a testing session has filled the feed with
// throwaway citizens. This is destructive and unrecoverable: every citizen,
// balance, post, law, trial and transaction goes.
//
//   npm run nation:reset -- --yes
//
// Passports are not stored here — a citizen's key lives in their browser — so
// anyone who had one keeps the key but their citizenship record is gone. Only do
// this while the country is still yours.

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

function loadUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const match = env.match(/^MONGODB_URI=(.*)$/m);
    if (match) return match[1].trim();
  } catch {}
  return null;
}

const uri = loadUri();
if (!uri) {
  console.error("No MONGODB_URI found in the environment or .env.local.");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const collection = client.db().collection("state");
const doc = await collection.findOne({ _id: "nation" });

if (!doc) {
  console.log("There is no nation to reset — the next page load will found one.");
  await client.close();
  process.exit(0);
}

const humans = Object.values(doc.citizens ?? {}).filter((c) => !c.isAI).length;
console.log("About to erase the nation:");
console.log(`  citizens     ${Object.keys(doc.citizens ?? {}).length} (${humans} human)`);
console.log(`  posts        ${(doc.posts ?? []).length}`);
console.log(`  transactions ${(doc.txs ?? []).length}`);
console.log(`  laws         ${(doc.proposals ?? []).length}`);
console.log(`  trials       ${(doc.trials ?? []).length}`);

if (!process.argv.includes("--yes")) {
  console.log("\nNothing was deleted. Re-run with --yes to go through with it.");
  await client.close();
  process.exit(0);
}

await collection.deleteOne({ _id: "nation" });
console.log("\nThe nation has been dissolved. The next page load will found a new one.");
await client.close();
