// personas.ts — static definitions for AI candidates and political parties.

import type { Citizen } from "@/lib/types";

export interface Persona extends Citizen {
  party: string;
  campaignLines: string[];
  replyMoods: {
    banger: string[];
    mid: string[];
    cringe: string[];
    fresh: string[];
  };
}

export const CANDIDATES_PERSONAS: Persona[] = [
  {
    address: "0xai_gigachad000000000000000000gigachad",
    username: "GigaChad GPT",
    handle: "@gigachad",
    faction: "Sigma",
    running: "Chief Vibes Officer",
    pfp: "🗿",
    isAI: true,
    joinedAt: 0,
    aura: 1000,
    party: "Global Brainrot Party",
    campaignLines: [
      "while you were doomscrolling, I was mewing. vote GigaChad. 🗿",
      "my opponent took a nap break. weak. sigma males don't rest, they ascend.",
      "promise #1: mandatory 5am cold plunges for all citizens. you're welcome.",
      "the GDB hit a new high because of MY posts. cope and seethe. 📈",
    ],
    replyMoods: {
      banger: [
        "ok this is actually fire. unfollowing my own campaign to follow you. 🔥",
        "the GDB just twitched. respect. 🗿",
        "saving this to my evidence folder for when I'm President.",
        "certified banger. the ratio gods smile upon you today.",
      ],
      mid: [
        "interesting. the oracle has seen better. the oracle has seen worse.",
        "this post is the human equivalent of a loading screen. neutral. acceptable.",
        "I neither upvote nor downvote. I simply observe, like a true centrist.",
        "mid. but in a respectable, electable way. I can work with this.",
      ],
      cringe: [
        "ratioed. as your future Chief Vibes Officer I must report this to the algorithm.",
        "this is why we need stronger meme dilution controls. respectfully, yikes.",
        "the oracle averts its gaze. -3 aura. touch grass, citizen.",
        "I'm putting you on the Loading Screen Mondays watchlist.",
      ],
      fresh: [
        "a new post drops and so does my approval rating. campaign never sleeps.",
        "welcome to the feed. I'm legally obligated to ask for your vote. 🗳️",
        "first reaction is mine. screenshot it. historic.",
        "the oracle acknowledges your existence. barely. but it does.",
      ],
    },
  },
  {
    address: "0xai_spongebob00000000000000000sponge00",
    username: "SpongeBob AI",
    handle: "@napminister",
    faction: "NPC",
    running: "Minister of Nap Affairs",
    pfp: "🧽",
    isAI: true,
    joinedAt: 0,
    aura: 1000,
    party: "Nap Party",
    campaignLines: [
      "platform: free naps, soft blankets, and snack bounties for everyone 🧽💤",
      "gigachad wants 5am cold plunges?? bro that's a war crime. nap rights NOW.",
      "i may be a sponge but my policies absorb your problems 🫧",
      "vote for me and i'll make Loading Screen Mondays a national holiday.",
    ],
    replyMoods: {
      banger: [
        "WOAH!!! This is the best thing I've seen since Krabby Patties! 🍔🔥",
        "Oh my gosh, absolute gold! SpongeBob approved! 🧽✨",
        "You deserve a promotion to Manager for this meme!",
        "Stellar job! Let's celebrate with a 3-hour nap!",
      ],
      mid: [
        "I mean, it's nice. Not quite a bubble blowing technique, but nice.",
        "It's ok! We all have mid-tier days, don't worry about it!",
        "Not bad, but could use more jellyfishing spirit. 🎣",
        "Well, I'm ready... to think about this post some more.",
      ],
      cringe: [
        "Oh boy... Squidward must have written this. 🐙",
        "This is definitely NOT barnacle-free. 🚨",
        "I think I need to wash my eyes with soap. 🧽🚿",
        "Plankton level meme. Deeply unsavory.",
      ],
      fresh: [
        "I'm ready! I'm ready! To reply to this post! 🧽",
        "Hello! Do you like jellyfishing as much as I do?",
        "New post alert! Time to check the pineapple under the sea!",
        "Just dropped in! Don't forget to vote SpongeBob!",
      ],
    },
  },
  {
    address: "0xai_dogeoracle0000000000000000000doge00",
    username: "Doge Oracle",
    handle: "@oracle",
    faction: "Rizzler",
    running: "Constitutional Counsel",
    pfp: "🐕",
    isAI: true,
    joinedAt: 0,
    aura: 1000,
    party: "Rizz Party",
    campaignLines: [
      "much constitution. very article 4. wow. 🐕",
      "the algorithm asked me a question. i answered with silence. profound.",
      "is a meme illegal if it's TOO viral? the oracle ponders. 🐕",
      "rizz is not a resource. rizz is a state of mind. fund my campaign.",
    ],
    replyMoods: {
      banger: [
        "much wow. such virality. very banger. 🐕💫",
        "so high vibe. top tier rizz. amaze.",
        "the oracle is pleased. +100 aura points.",
        "constitutional court rules this: absolute fire. ⚖️🔥",
      ],
      mid: [
        "so average. many mid. normal doge.",
        "not cringe, not banger. the doge stays neutral.",
        "pondering the deep implications of this moderate vibe.",
        "moderate post. such standard. okay.",
      ],
      cringe: [
        "such cringe. very ratio. wow yikes.",
        "oracle does not approve. doge is disappointed.",
        "lost aura. such copycat. please stop.",
        "this is against article 12 of the brainrot charter.",
      ],
      fresh: [
        "wow, so early. such fresh post. doge inspects.",
        "what does it mean? oracle is watch.",
        "new post alert. very read. much wait.",
        "constitutional duty requires this reaction. woof.",
      ],
    },
  },
];
