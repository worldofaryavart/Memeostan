"use client";

import { useNation } from "./useNation";
import { me, allCitizens } from "@/lib/citizens";
import { allPosts } from "@/lib/posts";
import { groupFeed } from "@/lib/feed";
import OfficialNotices from "./OfficialNotices";
import TopBar from "./TopBar";
import Ticker from "./Ticker";
import Passport from "./Passport";
import ClaimBlock from "./ClaimBlock";
import Composer from "./Composer";
import PostCard from "./PostCard";
import MyCitizen from "./MyCitizen";
import { Dashboard, ActivePoll, Parties, Leaderboard, Ledger, TopMeme } from "./DataBlocks";
import * as N from "./Nonsense";
import FloatingStickers from "./FloatingStickers";
import PageHero from "./PageHero";

// THE CABINET — the citizens currently holding elected office, as taped index
// cards. It used to list AI ministers, which was the whole thing that was wrong:
// nobody elected them and they were never going to leave.
function Cabinet() {
  const ministers = allCitizens().filter(
    (c) => !c.isAI && c.running && c.running !== "Candidate"
  );
  if (ministers.length === 0) return null;
  return (
    <section style={{ marginTop: 28 }}>
      <div className="section-title">🏛️ THE CABINET</div>
      <div className="section-sub">elected by memes. working for memes.</div>
      <div className="cabinet-grid">
        {ministers.map((m, idx) => {
          const colors = ["p-white", "p-lime", "p-pink", "p-cyan", "p-yellow"];
          const fasteners = ["staple-r", "pin", "paper-clip", "staple", "taped tape-pink"];
          const skin = colors[idx % colors.length];
          const fastener = fasteners[idx % fasteners.length];
          return (
            <div key={m.address} className={`paper ${skin} ${fastener}`}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 34 }}>{m.pfp}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="poster" style={{ fontSize: 15, lineHeight: 1 }}>{m.running}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>{m.handle ?? m.username}</div>
                </div>
              </div>
              <span className="sticker s-purple" style={{ marginTop: 10 }}>{m.faction}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const { refresh } = useNation();

  const citizen = me();
  const posts = allPosts();

  // sidebar flavor panels — pure in-world nonsense, on the new palette
  const sidebarFiller = [
    <N.QuickNap key="nap" />,
    <N.NationalHoliday key="nh" />,
    <N.BrainrotFM key="fm" />,
    <N.MapOfMemeostan key="map" />,
    <N.CitizenRights key="rights" />,
    <N.MemecoinPrice key="mc" />,
  ];

  // a few flavor cards to sprinkle into the feed so functional blocks hide in the mess
  const feedFiller = [
    <N.AIMinister key="aim" />,
    <N.BreakingNews key="bn" />,
    <N.DailyReminder key="dr" />,
    <N.UpgradeBrainrot key="up" />,
  ];

  // Fold runs of consecutive state notices into one card before rendering, so a
  // stack of four court filings doesn't push the actual square off the screen.
  const feed: React.ReactNode[] = [];
  let slot = 0;
  groupFeed(posts).forEach((entry) => {
    if (entry.kind === "notices") {
      feed.push(<OfficialNotices key={`notices-${entry.posts[0].id}`} posts={entry.posts} />);
    } else {
      feed.push(<PostCard key={entry.post.id} post={entry.post} refresh={refresh} />);
    }
    slot += 1;
    if (slot === 2) feed.push(<ActivePoll key="poll" />);
    if (slot > 2 && slot % 3 === 0 && feedFiller.length) feed.push(feedFiller.shift());
  });
  feed.push(...feedFiller);

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell" style={{ position: "relative" }}>
        <FloatingStickers />

        <PageHero
          kicker="memedemocracy is in session"
          title="THE PUBLIC SQUARE"
          titleAccent="SQUARE"
          tagline="post. vote. meme. rule."
          subtagline="one live feed — the whole country happens here."
        />

        <div className="cols">
          {/* LEFT — the public square feed */}
          <div className="col-stack">
            <Composer refresh={refresh} />
            <div className="feed-container">
              {posts.length === 0 && (
                <div className="paper">
                  <p className="hand" style={{ fontSize: 18 }}>no posts yet. post to the public square, citizen. 🚀</p>
                </div>
              )}
              {feed}
            </div>
          </div>

          {/* RIGHT — passport + the situation room */}
          <aside className="col-stack">
            {citizen ? <Passport citizen={citizen} /> : <ClaimBlock refresh={refresh} />}
            {citizen && <MyCitizen />}
            <TopMeme />
            <Dashboard />
            <Parties />
            <Leaderboard />
            <Ledger />
            {sidebarFiller}
          </aside>
        </div>

        <Cabinet />
      </div>

      <Ticker />
    </>
  );
}
