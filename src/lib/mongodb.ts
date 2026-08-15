import { MongoClient, Db } from "mongodb";

// The connection is opened on first use, not when this module is imported.
//
// Reading MONGODB_URI at module scope and throwing made `next build` fail while
// collecting page data for the API routes — so a deploy to any host that builds
// without runtime env vars present died with "Failed to collect page data"
// instead of anything that pointed at the real cause. Building the app should
// never require a database; talking to one should.

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let connecting: Promise<{ client: MongoClient; db: Db }> | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Serverless invocations can race on a cold start; share the in-flight connect
  // rather than opening a second client per request.
  if (connecting) return connecting;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local locally, or to the environment variables of wherever this is deployed."
    );
  }

  connecting = (async () => {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    cachedClient = client;
    cachedDb = db;
    return { client, db };
  })();

  try {
    return await connecting;
  } catch (err) {
    connecting = null; // let the next request try again rather than caching a failure
    throw err;
  } finally {
    if (cachedClient) connecting = null;
  }
}
