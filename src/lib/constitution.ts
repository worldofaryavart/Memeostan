// constitution.ts — the bridge between what citizens pass and what the state enforces.
//
// Until now these were two unrelated systems. A referendum that passed awarded
// the proposer 200 MMC, posted a card, and changed nothing; meanwhile the Cyber
// Police enforced three offences hardcoded in a TypeScript file that no vote
// could reach. Citizens legislated into a void and the state policed a rulebook
// nobody had agreed to.
//
// A law here is a title, a description, and a **machine-checkable rule**. That
// last part is the whole design. Free text would mean asking a model whether a
// post "feels illegal", which is unfalsifiable, unpredictable and impossible to
// argue with in court. A citizen has to be able to read the constitution and
// know, before they hit post, whether they are breaking it.
//
// Three consequences fall out of taking that seriously:
//
//   • Laws are repealable. A constitution that only accretes ends with every
//     post illegal. Repeal is itself a bill, so removing a law needs the same
//     majority that added one.
//   • Enforcement is never retroactive. A post published before an article was
//     enacted cannot be cited under it — see `lawsInForceFor`.
//   • The three founding articles are seeded as ordinary enacted bills, not as
//     code. Which means the citizens can repeal them. They can legalise logic.

import { db } from "./db";
import { CONSTITUTIONAL_COURT } from "./systemAccounts";
import type { LawRule, Post, Proposal } from "./types";

/** Words that constitute Logic. Seeded as Article 1; repealable like anything else. */
export const LOGIC_MARKERS = [
  "actually",
  "technically",
  "statistically",
  "objectively",
  "scientifically",
  "evidence",
  "therefore",
  "correlation",
  "in fact",
  "the data",
];

export const SPAM_WINDOW_MS = 5 * 60 * 1000;

// ── the founding articles ────────────────────────────────────────────────────

interface FoundingArticle {
  id: string;
  title: string;
  description: string;
  rule: LawRule;
}

export const FOUNDING_ARTICLES: FoundingArticle[] = [
  {
    id: "prop_founding_logic",
    title: "Logic is banned in public spaces",
    description:
      "Public spaces are for vibes. Reasoning, citing evidence or appealing to data in the square is an act of aggression against the Memeocracy.",
    rule: { type: "ban_word", words: LOGIC_MARKERS },
  },
  {
    id: "prop_founding_flooding",
    title: "The commons shall not be flooded",
    description:
      "No citizen may publish more than three times in five minutes. Volume dilutes Gross Domestic Brainrot and the currency that rests on it.",
    rule: { type: "post_limit", n: 3 },
  },
  {
    id: "prop_founding_cringe",
    title: "Cringe shall not be distributed",
    description:
      "A post carrying three or more downvotes, and more downvotes than upvotes, constitutes public vibe contamination.",
    rule: { type: "ratio_limit", n: 3 },
  },
];

// ── reading the constitution ─────────────────────────────────────────────────

/** Every article currently in force, in article order. */
export function activeLaws(): Proposal[] {
  return (db.get().proposals ?? [])
    .filter(
      (p) =>
        p.status === "enacted" &&
        !p.repealedBy &&
        p.rule &&
        p.rule.type !== "repeal"
    )
    .sort((a, b) => (a.article ?? 0) - (b.article ?? 0));
}

/**
 * The articles that may be applied to a given post.
 *
 * A law cannot reach backwards. If the square legalises a word on Tuesday, the
 * posts that used it on Monday were legal when they were made and stay legal;
 * equally, banning a word today does not make yesterday's posts a crime. Without
 * this, enacting an article would retroactively criminalise the entire feed at
 * once and the Cyber Police would have a very busy afternoon.
 */
export function lawsInForceFor(post: Pick<Post, "at">): Proposal[] {
  return activeLaws().filter((law) => post.at >= (law.enactedAt ?? 0));
}

export function nextArticleNumber(): number {
  const used = (db.get().proposals ?? [])
    .map((p) => p.article ?? 0)
    .filter((n) => n > 0);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

export function lawByArticle(article: number): Proposal | null {
  return (db.get().proposals ?? []).find((p) => p.article === article) ?? null;
}

// ── describing a rule in words a citizen can act on ──────────────────────────

export function describeRule(rule: LawRule): string {
  switch (rule.type) {
    case "ban_word": {
      const words = rule.words ?? [];
      if (words.length === 0) return "Bans nothing in particular.";
      if (words.length === 1) return `The word "${words[0]}" may not appear in a post.`;
      return `These may not appear in a post: ${words.map((w) => `"${w}"`).join(", ")}.`;
    }
    case "require_image":
      return "Every post must carry a picture.";
    case "post_limit":
      return `No more than ${rule.n} posts in five minutes.`;
    case "min_length":
      return `A post must be at least ${rule.n} characters, unless it carries a picture.`;
    case "ratio_limit":
      return `A post may not stand at ${rule.n} or more downvotes with more downvotes than upvotes.`;
    case "repeal":
      return `Repeals Article ${rule.target ? articleNumberOf(rule.target) ?? "?" : "?"}.`;
    default:
      return "Unrecognised rule.";
  }
}

function articleNumberOf(proposalId: string): number | null {
  return (db.get().proposals ?? []).find((p) => p.id === proposalId)?.article ?? null;
}

// ── enforcement ──────────────────────────────────────────────────────────────

export interface Violation {
  law: Proposal;
  article: number;
  charge: string;
  /** Plain statement of what triggered it, for the citation and the court file. */
  basis: string;
}

type EnforceableRule = Exclude<LawRule["type"], "repeal">;

const CHARGE_FOR: Record<EnforceableRule, string> = {
  ban_word: "USE OF A PROSCRIBED WORD",
  require_image: "PUBLISHING WITHOUT ILLUSTRATION",
  post_limit: "FLOODING THE COMMONS",
  min_length: "INSUFFICIENT EFFORT",
  ratio_limit: "EXCESSIVE CRINGE DISTRIBUTION",
};

/** Does this post break this article? Pure. */
export function testLaw(law: Proposal, post: Post): Violation | null {
  const rule = law.rule;
  if (!rule || rule.type === "repeal") return null;

  const article = law.article ?? 0;
  const ruleType: EnforceableRule = rule.type;
  const make = (basis: string): Violation => ({
    law,
    article,
    charge: CHARGE_FOR[ruleType],
    basis,
  });

  const text = (post.text || "").toLowerCase();

  switch (rule.type) {
    case "ban_word": {
      const hit = (rule.words ?? []).find((word) => text.includes(word.toLowerCase()));
      return hit ? make(`The post contains "${hit}", which Article ${article} proscribes.`) : null;
    }

    case "require_image":
      return post.image
        ? null
        : make(`The post carries no picture, which Article ${article} requires.`);

    case "min_length": {
      const min = rule.n ?? 0;
      if (post.image) return null;
      const length = (post.text || "").trim().length;
      return length < min
        ? make(`The post is ${length} characters against the ${min} Article ${article} requires.`)
        : null;
    }

    case "ratio_limit": {
      const limit = rule.n ?? 3;
      return post.down >= limit && post.down > post.up
        ? make(
            `The post stands at ${post.down} downvotes against ${post.up} upvotes, past the ${limit} Article ${article} allows.`
          )
        : null;
    }

    case "post_limit": {
      const limit = rule.n ?? 3;
      // Counted against posts inside the window, which is the same window the
      // patrol looks at — so the count a citizen can see is the count they're charged on.
      const recent = db
        .get()
        .posts.filter(
          (p) => p.author === post.author && p.at >= Date.now() - SPAM_WINDOW_MS
        ).length;
      return recent > limit
        ? make(
            `The author has published ${recent} posts in five minutes, past the ${limit} Article ${article} allows.`
          )
        : null;
    }

    default:
      return null;
  }
}

/** The first article a post breaks, if any. One charge at a time. */
export function violationOf(post: Post): Violation | null {
  for (const law of lawsInForceFor(post)) {
    const violation = testLaw(law, post);
    if (violation) return violation;
  }
  return null;
}

// ── enacting ─────────────────────────────────────────────────────────────────

/**
 * Give a newly passed bill its place in the constitution, or carry out its
 * repeal. Runs inside the mutation that enacted it.
 *
 * Returns a line describing what changed, for the court's announcement.
 */
export function enact(proposal: Proposal): string {
  const rule = proposal.rule;

  if (rule?.type === "repeal") {
    const target = (db.get().proposals ?? []).find((p) => p.id === rule.target);
    if (!target || target.repealedBy || target.status !== "enacted") {
      return "The article it sought to repeal is no longer in force. No change.";
    }
    db.update((s) => {
      const t = s.proposals?.find((p) => p.id === rule.target);
      if (t) t.repealedBy = proposal.id;
    });
    return `Article ${target.article} ("${target.title}") is repealed and ceases to have effect.`;
  }

  if (!rule) {
    // A bill with no rule is a statement of intent — it passes, it is recorded,
    // and it binds nobody. Kept legal on purpose: not every motion is a law.
    return "Recorded as a resolution of the assembly. It creates no enforceable duty.";
  }

  const article = nextArticleNumber();
  db.update((s) => {
    const p = s.proposals?.find((x) => x.id === proposal.id);
    if (p) {
      p.article = article;
      p.enactedAt = Date.now();
    }
  });

  return `Entered as Article ${article}. ${describeRule(rule)} Enforcement begins now and is not retroactive.`;
}

/** Seed the founding articles. Idempotent — see bootNation. */
export function seedFoundingArticles(): void {
  db.update((s) => {
    if (!s.proposals) s.proposals = [];

    FOUNDING_ARTICLES.forEach((article, index) => {
      if (s.proposals!.some((p) => p.id === article.id)) return;
      s.proposals!.push({
        id: article.id,
        creator: CONSTITUTIONAL_COURT,
        title: article.title,
        description: article.description,
        status: "enacted",
        yesVotes: [],
        noVotes: [],
        endsAt: 0,
        at: 0,
        rule: article.rule,
        article: index + 1,
        // Founding articles predate every post, so nothing is grandfathered out
        // of them. Any article a citizen passes later starts from its own date.
        enactedAt: 0,
      });
    });
  });
}
