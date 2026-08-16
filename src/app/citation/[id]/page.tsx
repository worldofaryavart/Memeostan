// /citation/<postId> — the page a shared citation links to.
//
// Two jobs. For a crawler (Twitter, Discord, Slack, iMessage) it carries the OG
// tags that make the card render as a preview. For a person who clicks through,
// it is the country's actual front door: the first thing a stranger ever sees of
// Memeostan is a real citizen being fined by a real institution for a real post,
// which explains the whole idea faster than any landing copy could.
//
// Deliberately server-rendered and free of the client nation state. It has to
// work before anyone has a passport, and it has to work for a robot.

import type { Metadata } from "next";
import Link from "next/link";
import { loadState } from "@/lib/serverState";
import { noticeFor, type Notice } from "@/lib/citations";

export const dynamic = "force-dynamic";

const SITE = process.env.MEMEOSTAN_PUBLIC_URL || "https://memeostan.xyz";

const HEADLINE: Record<Notice["kind"], string> = {
  citation: "cited by the Cyber Police",
  guilty: "found guilty by the Supreme Court",
  innocent: "acquitted by the Supreme Court",
};

async function load(id: string): Promise<Notice | null> {
  try {
    return noticeFor(await loadState(), id);
  } catch (err) {
    console.error("citation page: could not read state:", err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const notice = await load(id);

  const title = notice
    ? `@${notice.username} was ${HEADLINE[notice.kind]}`
    : "United Memeostan";
  const description = notice
    ? notice.article
      ? `${notice.article}. In Memeostan the citizens write the laws and an AI government enforces them.`
      : "In Memeostan the citizens write the laws and an AI government enforces them."
    : "A nation where the citizens write the laws and an AI government enforces them.";

  const image = `${SITE}/api/card/${id}`;

  return {
    title,
    description,
    openGraph: { title, description, images: [image], url: `${SITE}/citation/${id}`, type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function CitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notice = await load(id);

  if (!notice) {
    return (
      <div className="shell" style={{ paddingTop: 60 }}>
        <div className="paper p-white" style={{ padding: 28 }}>
          <div className="poster" style={{ fontSize: 32 }}>NO RECORD</div>
          <p className="hand" style={{ fontSize: 16, marginTop: 8 }}>
            The registry has no notice against this post. It may have been lawful,
            or it may have scrolled out of the national archive.
          </p>
          <Link href="/" className="btn lime" style={{ marginTop: 18, display: "inline-block" }}>
            Go to Memeostan
          </Link>
        </div>
      </div>
    );
  }

  const stamp =
    notice.kind === "citation" ? "CITATION" : notice.kind === "guilty" ? "GUILTY" : "ACQUITTED";
  const skin = notice.kind === "guilty" ? "p-pink" : notice.kind === "innocent" ? "p-cyan" : "p-yellow";

  return (
    <div className="shell" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className={`paper ${skin} binder-clip`} style={{ padding: 28 }}>
        <div className="mono" style={{ fontSize: 12, letterSpacing: 3, opacity: 0.7 }}>
          UNITED MEMEOSTAN · OFFICIAL NOTICE
        </div>

        <div className="poster" style={{ fontSize: 54, lineHeight: 1, marginTop: 10 }}>
          {stamp}
        </div>

        {notice.article && (
          <div className="marker" style={{ fontSize: 20, marginTop: 12 }}>
            {notice.article}
          </div>
        )}

        <blockquote
          style={{
            borderLeft: "6px solid var(--ink)",
            paddingLeft: 14,
            margin: "18px 0",
            fontStyle: "italic",
            fontSize: 18,
          }}
        >
          {notice.post.text || "(a picture)"}
        </blockquote>

        <p className="hand" style={{ fontSize: 17, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
          {notice.text}
        </p>

        {notice.penalty && (
          <div className="mono" style={{ fontSize: 14, marginTop: 14, fontWeight: 700 }}>
            Penalty: {notice.penalty}
            {notice.benchVerdict && " · ruled from the bench, no jury sat"}
          </div>
        )}

        <div className="mono" style={{ fontSize: 13, marginTop: 18, opacity: 0.75 }}>
          Citizen @{notice.username} · {new Date(notice.at).toUTCString()}
        </div>
      </div>

      {/* The pitch, for the stranger who arrived here from someone else's timeline. */}
      <div className="paper p-white staple" style={{ padding: 24, marginTop: 20 }}>
        <div className="poster" style={{ fontSize: 26, lineHeight: 1.05 }}>
          THE CITIZENS WRITE THE LAWS.<br />THE GOVERNMENT IS AI.
        </div>
        <p className="hand" style={{ fontSize: 16, marginTop: 10, lineHeight: 1.45 }}>
          Memeostan is a small internet nation. Every citizen is a real person. The
          police, the courts, the treasury and the election commission are run by AI,
          so nobody has to do the paperwork. Pass a bill and the state starts
          enforcing it on everyone — including you. Repeal it and the state stops.
        </p>
        <Link href="/" className="btn lime" style={{ marginTop: 16, display: "inline-block" }}>
          Claim a passport →
        </Link>
      </div>
    </div>
  );
}
