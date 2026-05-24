// engine.ts — brings the AI candidates to life.
//   - onUserPost(): when YOU post, candidates reply in character (the magic).
//   - startCampaignLoop(): candidates periodically drop campaign posts and vote.

import { CANDIDATES, generateReply, campaignPost } from "./candidates";
import { addReply, createPost, getPost, vote } from "@/lib/posts";
import { db } from "@/lib/db";
import { vibeOf, checkAndFireEvents, recordGdbSnapshot } from "@/lib/economy";
import { governance } from "@/lib/governance";
import { elections } from "@/lib/elections";
import { CANDIDATES_PERSONAS } from "./personas";

type Notify = () => void;

// When a human posts, 1–2 candidates react after a beat (feels alive, not instant).
export function onUserPost(postId: string, onUpdate: Notify): void {
  const reactors = [...CANDIDATES]
    .sort(() => Math.random() - 0.5)
    .slice(0, 1 + Math.floor(Math.random() * 2));

  reactors.forEach((c, i) => {
    setTimeout(() => {
      const post = getPost(postId);
      if (!post) return;
      
      // a candidate's reaction also nudges the vote (they're citizens too)
      if (Math.random() > 0.5) {
        vote(postId, c.address, Math.random() > 0.4 ? "up" : "down");
      }
      
      const fresh = getPost(postId);
      if (fresh) {
        // Try calling the Next.js API route first for candidate reply
        fetch("/api/ai/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateAddress: c.address,
            postText: fresh.text,
            postAuthor: fresh.author,
            postVibe: vibeOf(fresh),
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.reply) {
              addReply(postId, c.address, data.reply);
            } else {
              addReply(postId, c.address, generateReply(c, fresh));
            }
            onUpdate();
          })
          .catch(() => {
            // Offline/error fallback to local generation
            addReply(postId, c.address, generateReply(c, fresh));
            onUpdate();
          });
      }
    }, 900 + i * 1100 + Math.random() * 600);
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

      const text = post.text.toLowerCase();
      let replyText = "";

      if (type === "referendum") {
        if (c.username.includes("GigaChad")) {
          const yesWords = ["sigma", "mewing", "cold plunge", "grind", "gdb", "work", "gym", "lift"];
          const noWords = ["nap", "sleep", "break", "rest", "lazy"];
          if (yesWords.some((w) => text.includes(w))) {
            replyText = "🗿 PEAK SIGMA PROPOSAL. Under my watch, we will mandate this. +100 Aura for filing this. 📈";
          } else if (noWords.some((w) => text.includes(w))) {
            replyText = "🗿 Too much slacking. Naps are for the weak NPC class. Vote NO on this immediately. 🤫";
          } else {
            replyText = "🗿 Does this bill increase GDB? If not, it is mid and lacks grindset. We need mewing laws instead.";
          }
        } else if (c.username.includes("Sponge")) {
          const yesWords = ["nap", "sleep", "break", "rest", "blanket", "holiday", "snack", "krabby", "burger"];
          const noWords = ["cold plunge", "mewing", "grind", "5am"];
          if (yesWords.some((w) => text.includes(w))) {
            replyText = "🧽 I'M READY to vote YES! Naps and snack breaks are basic human rights. Cozy vibes only! 💤";
          } else if (noWords.some((w) => text.includes(w))) {
            replyText = "🧽 5 AM cold plunges?? Bro, that is literally a torture technique. Barnacles. Vote NO! 🚨";
          } else {
            replyText = "🧽 Looks cozy enough! Let's pass this and go jellyfishing! 🫧";
          }
        } else if (c.username.includes("Doge")) {
          const yesWords = ["rizz", "wow", "amaze", "constitution", "court", "charter", "silence", "oracle"];
          const noWords = ["cringe", "spam", "ratio"];
          if (yesWords.some((w) => text.includes(w))) {
            replyText = "🐕 Wow, such legislation. Very constitutional. The oracle decrees this a massive win. Much support.";
          } else if (noWords.some((w) => text.includes(w))) {
            replyText = "🐕 Very cringe. Oracle detects zero rizz in this bill. Lost aura. Much ratio expected.";
          } else {
            replyText = "🐕 Pondering this proposal. Many variables. Very logic. Let the voters decide. Wow.";
          }
        }
      } else if (type === "candidacy") {
        if (c.username.includes("GigaChad")) {
          replyText = "🗿 Another challenger enters the arena. Unless you can mew for 48 hours straight, you stand no chance. 🤫";
        } else if (c.username.includes("Sponge")) {
          replyText = "🧽 Good luck! Let's keep it clean, friendly, and make sure we schedule a group nap break later! 🫧💤";
        } else if (c.username.includes("Doge")) {
          replyText = "🐕 Wow. Another candidate. Much competition. Let the rizz war commence. Good luck, citizen. Wow.";
        }
      }

      if (replyText) {
        addReply(postId, c.address, replyText);
        onUpdate();
      }
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

      const postText = post.text.toLowerCase();
      let replyText = "";

      if (opponent.username.includes("GigaChad")) {
        if (postText.includes("nap") || postText.includes("sleep") || postText.includes("lazy") || postText.includes("break")) {
          replyText = "🗿 Naps are for NPCs. A true sigma is always mewing, cold plunging, or grinding. Vote GigaChad. 🗿";
        } else {
          replyText = "🗿 Acceptable. But does it increase your deadlift? Sigma grindset demands physical superiority.";
        }
      } else if (opponent.username.includes("Sponge")) {
        if (postText.includes("mewing") || postText.includes("plunge") || postText.includes("grind") || postText.includes("cvo")) {
          replyText = "🧽 Woah there, chill out GigaChad! Cold water at 5 AM? That sounds like a disaster. Nap time is way better! 💤";
        } else {
          replyText = "🧽 Sounds fun, but is it cozy? Let's have a snack and talk about this over a nice nap. 🫧";
        }
      } else if (opponent.username.includes("Doge")) {
        replyText = "🐕 Wow, very campaign statement. Much debate. Doge Oracle is watching. Such politics. Amaze.";
      }

      if (replyText) {
        addReply(postId, opponent.address, replyText);
        onUpdate();
      }
    }, 1200 + i * 1600 + Math.random() * 600);
  });
}

// Periodic campaign chatter so the feed keeps moving on its own.
export function startCampaignLoop(onUpdate: Notify, intervalMs = 18000): number {
  let seed = Date.now();
  return window.setInterval(() => {
    // 1. Candidate drops a campaign post
    const c = CANDIDATES[Math.floor(Math.random() * CANDIDATES.length)];
    const post = createPost({ author: c.address, text: campaignPost(c, seed++) });
    triggerAICampaignDebate(post.id, c.address, onUpdate);

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

    // 5. Record GDB snapshot for trend tracking
    recordGdbSnapshot();

    // 6. Check and fire economic events — if one fires, post breaking news + AI commentary
    const firedEvent = checkAndFireEvents();
    if (firedEvent) {
      const newsPost = createPost({
        author: CANDIDATES[0].address, // use GigaChad as the news anchor
        text: `📰 BREAKING: ${firedEvent.title}\n\n${firedEvent.description}`,
      });

      // Each AI candidate reacts to the event in character
      const eventCommentary: Record<string, Record<string, string>> = {
        crash: {
          gigachad: "🗿 A market crash only eliminates the weak. True sigmas stack mewing reps, not MMC. My portfolio is pure discipline. 📉➡️📈",
          sponge:  "🧽 OH BARNACLES!! My Krabby Patty retirement fund!! I knew I should have kept it under the mattress! 😱💔",
          doge:    "🐕 Wow. Much crash. Very sad wallet. Doge oracle predicted this. Such hindsight. Many ngmi.",
        },
        boom: {
          gigachad: "🗿 The Brainrot Boom confirms the sigma grindset is WINNING. GDB climbs like your deadlift max. Keep mewing, citizens. 💪",
          sponge:  "🧽 FREE MONEY?! This is the BEST DAY EVER! I'm buying 1000 Krabby Patties!! 🎉🍔💚",
          doge:    "🐕 Wow. Much airdrop. Very gain. Such generosity from the Federal Reserve of Brainrot. Amaze. To the moon. Wow.",
        },
        inflation: {
          gigachad: "🗿 Inflation is caused by low-effort cringe posters. Stop posting slop. Mew more. Sigma grindset is deflationary. 🗿",
          sponge:  "🧽 Wait, my money is worth LESS now?? This is worse than the time I burned down the Krusty Krab. 😟",
          doge:    "🐕 Such inflation. Very cringe ratio. MMC goes down. Doge remains stoic. Much acceptance. Wow.",
        },
        tax_hike: {
          gigachad: "🗿 Taxes are for NPCs. A true sigma generates enough GDB to offset all surcharges through raw output. Adapt or perish. 💼",
          sponge:  "🧽 A TAX HIKE?! Patrick told me free money doesn't disappear this fast. I demand a nap recount! 😤",
          doge:    "🐕 Very tax. Such government. Many fee. Transfer wisely, citizens. Much caution. Wow.",
        },
        airdrop: {
          gigachad: "🗿 A stimulus airdrop is a dopamine hit for NPCs. A real sigma doesn't need government MMC. But I'll take it. 🗿",
          sponge:  "🧽 FREE MMC FOR EVERYONE?! I'm READY!! 🧽✨ First I buy snacks, then a new jellyfish net, then MORE snacks!",
          doge:    "🐕 Wow. Free MMC. Very grateful. Such Federal Reserve. Doge approves this airdrop. Much yes. Amaze.",
        },
      };

      const typeKey = firedEvent.type as keyof typeof eventCommentary;
      const comments = eventCommentary[typeKey];
      if (comments) {
        CANDIDATES.forEach((cand, i) => {
          const key = cand.username.toLowerCase().includes("gigachad")
            ? "gigachad"
            : cand.username.toLowerCase().includes("sponge")
            ? "sponge"
            : "doge";
          const commentText = comments[key];
          if (commentText) {
            setTimeout(() => {
              addReply(newsPost.id, cand.address, commentText);
              onUpdate();
            }, 1200 + i * 1400 + Math.random() * 500);
          }
        });
      }
    }

    onUpdate();
  }, intervalMs);
}
