// engine.ts — brings the AI candidates to life.
//   - onUserPost(): when YOU post, candidates reply in character (the magic).
//   - startCampaignLoop(): candidates periodically drop campaign posts and vote.

import { CANDIDATES } from "./candidates";
import { addReply, createPost, getPost, vote } from "@/lib/posts";
import { db } from "@/lib/db";
import { vibeOf, checkAndFireEvents, recordGdbSnapshot, tuneRatesAI } from "@/lib/economy";
import { governance } from "@/lib/governance";
import { elections } from "@/lib/elections";
import { CANDIDATES_PERSONAS } from "./personas";
import {
  ensureSupremeCourtAI,
  resolveTrials,
  fileCharge,
  voteOnTrial,
  getActiveTrials,
  SUPREME_COURT_ADDRESS,
} from "@/lib/judiciary";

type Notify = () => void;

// When a human posts, check if any AI is explicitly mentioned to trigger a reply beat.
export function onUserPost(postId: string, onUpdate: Notify): void {
  const fresh = getPost(postId);
  if (!fresh) return;

  const state = db.get();
  const allAI = Object.values(state.citizens).filter((cit) => cit.isAI);

  allAI.forEach((ai) => {
    const text = fresh.text.toLowerCase();
    const isMentioned = 
      text.includes(ai.username.toLowerCase()) || 
      (ai.handle && text.includes(ai.handle.toLowerCase()));

    if (isMentioned) {
      setTimeout(() => {
        const post = getPost(postId);
        if (!post) return;
        
        // A candidate's reaction also nudges the vote (they're citizens too)
        if (Math.random() > 0.5) {
          vote(postId, ai.address, Math.random() > 0.4 ? "up" : "down");
        }

        fetch("/api/ai/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateAddress: ai.address,
            postText: post.text,
            postAuthor: post.author,
            postVibe: vibeOf(post),
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.reply) {
              addReply(postId, ai.address, data.reply);
              onUpdate();
            }
          })
          .catch((err) => {
            console.error(`Failed to generate AI reply for @${ai.username}:`, err);
          });
      }, 900 + Math.random() * 1200);
    }
  });
}

export function onSystemPost(postId: string, type: "candidacy" | "referendum", onUpdate: Notify): void {
  if (type === "referendum") {
    aiVoteOnProposals();
  }

  // Trigger active AI candidates to comment on the announcement post
  const reactors = [...CANDIDATES].sort(() => Math.random() - 0.5);

  reactors.forEach((c, i) => {
    setTimeout(() => {
      const post = getPost(postId);
      if (!post) return;

      fetch("/api/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateAddress: c.address,
          postText: post.text,
          postAuthor: post.author,
          postVibe: vibeOf(post),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.reply) {
            addReply(postId, c.address, data.reply);
            onUpdate();
          }
        })
        .catch((err) => {
          console.error("Failed to generate AI system post reply:", err);
        });
    }, 1000 + i * 1500 + Math.random() * 500);
  });
}

function aiVoteOnProposals() {
  const activeProps = governance.allProposals().filter((p) => p.status === "active");
  if (activeProps.length === 0) return;

  CANDIDATES_PERSONAS.forEach((c) => {
    activeProps.forEach((prop) => {
      // Check if already voted
      if (prop.yesVotes.includes(c.address) || prop.noVotes.includes(c.address)) {
        return;
      }

      // Determine vote based on candidate's persona
      let voteType: "yes" | "no" = Math.random() > 0.5 ? "yes" : "no";
      const title = prop.title.toLowerCase();
      const desc = prop.description.toLowerCase();

      if (c.username.includes("GigaChad")) {
        const yesWords = ["sigma", "mewing", "cold plunge", "grind", "gdb", "work", "gym", "lift"];
        const noWords = ["nap", "sleep", "break", "rest", "lazy"];
        if (yesWords.some((w) => title.includes(w) || desc.includes(w))) voteType = "yes";
        else if (noWords.some((w) => title.includes(w) || desc.includes(w))) voteType = "no";
      } else if (c.username.includes("Sponge")) {
        const yesWords = ["nap", "sleep", "break", "rest", "blanket", "holiday", "snack", "krabby", "burger"];
        const noWords = ["cold plunge", "mewing", "grind", "5am"];
        if (yesWords.some((w) => title.includes(w) || desc.includes(w))) voteType = "yes";
        else if (noWords.some((w) => title.includes(w) || desc.includes(w))) voteType = "no";
      } else if (c.username.includes("Doge")) {
        const yesWords = ["rizz", "wow", "amaze", "constitution", "court", "charter", "silence", "oracle"];
        const noWords = ["cringe", "spam", "ratio"];
        if (yesWords.some((w) => title.includes(w) || desc.includes(w))) voteType = "yes";
        else if (noWords.some((w) => title.includes(w) || desc.includes(w))) voteType = "no";
      }

      governance.vote(prop.id, c.address, voteType);
    });
  });
}

function triggerAICampaignDebate(postId: string, authorAddress: string, onUpdate: Notify): void {
  // Let the other candidates comment/reply to this post after a short delay
  const opponents = CANDIDATES.filter((cand) => cand.address !== authorAddress);
  
  opponents.forEach((opponent, i) => {
    setTimeout(() => {
      const post = getPost(postId);
      if (!post) return;

      fetch("/api/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateAddress: opponent.address,
          postText: post.text,
          postAuthor: post.author,
          postVibe: vibeOf(post),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.reply) {
            addReply(postId, opponent.address, data.reply);
            onUpdate();
          }
        })
        .catch((err) => {
          console.error("Failed to generate AI debate comment:", err);
        });
    }, 1200 + i * 1600 + Math.random() * 600);
  });
}

// Periodic campaign chatter so the feed keeps moving on its own.
export function startCampaignLoop(onUpdate: Notify, intervalMs = 18000): number {
  return window.setInterval(() => {
    // 1. Candidate drops a campaign post via API
    const c = CANDIDATES[Math.floor(Math.random() * CANDIDATES.length)];
    fetch("/api/ai/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateAddress: c.address }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.text) {
          const post = createPost({ author: c.address, text: data.text });
          triggerAICampaignDebate(post.id, c.address, onUpdate);
          onUpdate();
        }
      })
    // 1b. Ghost citizen drops a shitpost via API (40% chance per tick)
    if (Math.random() < 0.4) {
      const state = db.get();
      const ghostAddresses = Object.keys(state.citizens).filter((addr) => addr.startsWith("0xghost"));
      if (ghostAddresses.length > 0) {
        const randGhostAddr = ghostAddresses[Math.floor(Math.random() * ghostAddresses.length)];
        fetch("/api/ai/campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateAddress: randGhostAddr }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.text) {
              const post = createPost({ author: randGhostAddr, text: data.text });
              triggerAICampaignDebate(post.id, randGhostAddr, onUpdate);
              onUpdate();
            }
          })
          .catch((err) => {
            console.error("Failed to generate ghost post:", err);
          });
      }
    }

    // 2. AI candidates vote on proposals
    aiVoteOnProposals();

    // 3. AI candidates vote on posts
    const posts = db.get().posts.slice(0, 8);
    if (posts.length > 0) {
      CANDIDATES.forEach((cand) => {
        if (Math.random() > 0.4) {
          const randPost = posts[Math.floor(Math.random() * posts.length)];
          if (randPost.author !== cand.address && !randPost.voters[cand.address]) {
            vote(randPost.id, cand.address, Math.random() > 0.3 ? "up" : "down");
          }
        }
      });
    }

    // 4. AI candidates vote in elections
    CANDIDATES.forEach((cand) => {
      const election = elections.getElection();
      if (election && !election.votes[cand.address]) {
        const target = Math.random() > 0.2 ? cand.address : (election.candidates.find((a) => a !== cand.address) || cand.address);
        elections.vote(cand.address, target);
      }
    });

    // 5. Record GDB snapshot for trend tracking and tune Federal Reserve rates
    recordGdbSnapshot();
    tuneRatesAI();

    // 6. Check and fire economic events — if one fires, post breaking news + AI commentary
    const firedEvent = checkAndFireEvents();
    if (firedEvent) {
      const newsPost = createPost({
        author: CANDIDATES[0].address, // use GigaChad as the news anchor
        text: `📰 BREAKING: ${firedEvent.title}\n\n${firedEvent.description}`,
      });

      // Each AI candidate reacts to the event dynamically in character
      CANDIDATES.forEach((cand, i) => {
        setTimeout(() => {
          fetch("/api/ai/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              candidateAddress: cand.address,
              postText: newsPost.text,
              postAuthor: newsPost.author,
              postVibe: 0,
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data && data.reply) {
                addReply(newsPost.id, cand.address, data.reply);
                onUpdate();
              }
            })
            .catch((err) => {
              console.error("Failed to generate dynamic AI event reply:", err);
            });
        }, 1200 + i * 1500 + Math.random() * 500);
      });
    }

    // 7. AI Judiciary: Resolve expired trials & scan for chargeable human citizens
    ensureSupremeCourtAI();
    resolveTrials();

    // AI candidates vote on active trials
    const activeTrialsForVoting = getActiveTrials();
    if (activeTrialsForVoting.length > 0) {
      CANDIDATES.forEach((cand) => {
        if (Math.random() > 0.4) {
          const randTrial = activeTrialsForVoting[Math.floor(Math.random() * activeTrialsForVoting.length)];
          // Only vote if they haven't voted yes or no yet
          if (!randTrial.yesVotes.includes(cand.address) && !randTrial.noVotes.includes(cand.address)) {
            let voteType: "guilty" | "innocent" = Math.random() > 0.5 ? "guilty" : "innocent";
            if (cand.username.includes("GigaChad")) {
              if (randTrial.charge.includes("CRINGE") || randTrial.charge.includes("NPC") || randTrial.charge.includes("SPAM")) {
                voteType = "guilty";
              }
            } else if (cand.username.includes("Sponge")) {
              if (randTrial.charge.includes("SPAM")) {
                voteType = "guilty";
              } else {
                voteType = "innocent";
              }
            }
            voteOnTrial(randTrial.id, cand.address, voteType);
          }
        }
      });
    }

    // Check if we can file a mock trial if none are active
    const active = getActiveTrials();
    if (active.length === 0 && Math.random() > 0.3) {
      const allCits = Object.values(db.get().citizens);
      const humans = allCits.filter((c) => !c.isAI);
      if (humans.length > 0) {
        const shuffled = [...humans].sort(() => Math.random() - 0.5);
        for (const citizen of shuffled) {
          // Limit to citizens without a trial in the last 5 minutes
          const recentTrials = (db.get().trials || []).filter(
            (t) => t.defendant === citizen.address && Date.now() - t.at < 300000
          );
          if (recentTrials.length > 0) continue;

          let charge = "";
          let desc = "";

          // a. Check spam (3+ posts in last 5 mins)
          const fiveMinsAgo = Date.now() - 300000;
          const userPostsLast5Mins = db.get().posts.filter((p) => p.author === citizen.address && p.at >= fiveMinsAgo);
          if (userPostsLast5Mins.length >= 3) {
            charge = "SPAM FLOODING THE COMMONS";
            desc = `Citizen @${citizen.username} is posting too fast (${userPostsLast5Mins.length} posts in last 5 minutes). This slop level threatens our circulating supply and dilutes GDB.`;
          }

          // b. Check logic warning
          if (!charge) {
            const userPosts = db.get().posts.filter((p) => p.author === citizen.address);
            const logicWarned = userPosts.some((p) =>
              p.replies.some(
                (r) =>
                  r.author === "0xai_cyberpolice000000000000000000police" &&
                  r.text.toLowerCase().includes("logic")
              )
            );
            if (logicWarned) {
              charge = "LOGIC USAGE IN A PUBLIC SPACE";
              desc = `Citizen @${citizen.username} was warned by the Cyber Police for using facts, reasoning, or scientific thinking in their posts. Under Article 1, we mandate pure vibe.`;
            }
          }

          // c. Check extreme ratio (downvotes >= 3 and downvotes > upvotes in last 10 mins)
          if (!charge) {
            const tenMinsAgo = Date.now() - 600000;
            const ratioedPost = db.get().posts.find(
              (p) => p.author === citizen.address && p.at >= tenMinsAgo && p.down >= 3 && p.down > p.up
            );
            if (ratioedPost) {
              charge = "EXCESSIVE CRINGE DISTRIBUTION";
              desc = `Citizen @${citizen.username} published a meme that received a net negative ratio (${ratioedPost.down} downvotes vs ${ratioedPost.up} upvotes). This is public vibe contamination.`;
            }
          }

          // d. Random NPC suspicion (5% chance)
          if (!charge && Math.random() < 0.05) {
            charge = "SUSPICION OF BEING AN NPC";
            desc = `An audit of citizen @${citizen.username}'s activities has raised red flags. They are exhibiting repetitive, un-sigmalike patterns. Turing test required.`;
          }

          if (charge) {
            fileCharge(SUPREME_COURT_ADDRESS, citizen.address, charge, desc);
            break; // file at most one trial per loop tick
          }
        }
      }
    }

    // 8. Dynamic AI Spawning: check population ratio to maintain 2:1 bot-to-human ratio
    const state = db.get();
    const citizensList = Object.values(state.citizens);
    const humansCount = citizensList.filter((cit) => !cit.isAI).length;
    const aiCount = citizensList.filter((cit) => cit.isAI).length;
    if (aiCount < humansCount * 2) {
      console.log(`Population equilibrium check triggered. AI count (${aiCount}) is lower than 2x humans (${humansCount}). Spawning new AI...`);
      fetch("/api/ai/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then(() => db.load())
        .then(() => onUpdate())
        .catch((err) => console.error("Failed to automatically spawn AI citizen:", err));
    }

    // 9. AI Attention Spans check on recent human posts
    const now = Date.now();
    const recentHumanPosts = db.get().posts.filter(
      (p) => p.at >= now - 5 * 60 * 1000 // last 5 minutes
    );

    const allCitizens = Object.values(state.citizens);
    const aiCitizens = allCitizens.filter((cit) => cit.isAI);

    recentHumanPosts.forEach((post) => {
      // Find the author citizen to see if they're a human
      const authorCit = state.citizens[post.author];
      if (authorCit && authorCit.isAI) return; // skip if the post was made by a bot

      aiCitizens.forEach((ai) => {
        // Check if this AI has already replied to this post
        const alreadyReplied = post.replies.some((r) => r.author === ai.address);
        if (alreadyReplied) return;

        // Check triggers:
        // 1. Mention
        const text = post.text.toLowerCase();
        const isMentioned = 
          text.includes(ai.username.toLowerCase()) || 
          (ai.handle && text.includes(ai.handle.toLowerCase()));

        // 2. Banger post (vibe > 5)
        const isBanger = vibeOf(post) > 5;

        // 3. Boosted post (boosts > 0)
        const isBoosted = (post.boosts || 0) > 0;

        // 4. Tipped candidate: transferred MMC from post.author to ai.address since post.at
        const hasTipped = state.txs.some(
          (tx) => 
            tx.type === "transfer" && 
            tx.from === post.author && 
            tx.to === ai.address && 
            tx.at >= post.at
        );

        if (isMentioned || isBanger || isBoosted || hasTipped) {
          // Trigger reply after a random short delay
          setTimeout(() => {
            // Fetch fresh state to ensure we don't reply twice
            const currentPost = getPost(post.id);
            if (!currentPost || currentPost.replies.some((r) => r.author === ai.address)) return;

            fetch("/api/ai/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                candidateAddress: ai.address,
                postText: currentPost.text,
                postAuthor: currentPost.author,
                postVibe: vibeOf(currentPost),
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data && data.reply) {
                  addReply(currentPost.id, ai.address, data.reply);
                  onUpdate();
                }
              })
              .catch((err) => {
                console.error(`Failed to generate AI attention reply for ${ai.username}:`, err);
              });
          }, Math.random() * 5000);
        }
      });
    });

    onUpdate();
  }, intervalMs);
}
