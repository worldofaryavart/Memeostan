// engine.ts — brings the AI candidates to life.
//   - onUserPost(): when YOU post, candidates reply in character (the magic).
//   - startCampaignLoop(): candidates periodically drop campaign posts and vote.

import { CANDIDATES, generateReply, campaignPost } from "./candidates";
import { addReply, createPost, getPost, vote } from "@/lib/posts";
import { db } from "@/lib/db";
import { vibeOf } from "@/lib/economy";
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

// Periodic campaign chatter so the feed keeps moving on its own.
export function startCampaignLoop(onUpdate: Notify, intervalMs = 18000): number {
  let seed = Date.now();
  return window.setInterval(() => {
    // 1. Candidate drops a campaign post
    const c = CANDIDATES[Math.floor(Math.random() * CANDIDATES.length)];
    createPost({ author: c.address, text: campaignPost(c, seed++) });

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

    onUpdate();
  }, intervalMs);
}
