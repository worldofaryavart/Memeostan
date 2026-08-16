// GET /api/card/<postId> — the share card.
//
// The best writing in Memeostan is what the state says to you when it fines you,
// and until now you had to break a law yourself to ever read any of it. This
// renders that moment as a 1200×630 image, so a citation is something a citizen
// can post somewhere else. It is the only growth loop the country has.
//
// ImageResponse supports a narrow slice of CSS: flexbox only, no grid, and every
// element with more than one child needs an explicit `display: flex`. Keep the
// markup boring.

import { ImageResponse } from "next/og";
import { loadState } from "@/lib/serverState";
import { noticeFor } from "@/lib/citations";

export const runtime = "nodejs";

const INK = "#0f0b1a";
const PAPER = "#f4efe2";

const PALETTE = {
  citation: { accent: "#ffd400", label: "CYBER POLICE CITATION", office: "Cyber Police Commission" },
  guilty: { accent: "#ff0055", label: "GUILTY", office: "Supreme Court of Memeostan" },
  innocent: { accent: "#00f5d4", label: "ACQUITTED", office: "Supreme Court of Memeostan" },
} as const;

function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let notice = null;
  try {
    notice = noticeFor(await loadState(), id);
  } catch (err) {
    console.error("share card: could not read state:", err);
  }

  // No notice is not an error — the post may simply be law-abiding. Render a
  // plain card rather than a broken image, because this URL ends up in an
  // <img> tag on someone else's website where a 404 is just a broken box.
  if (!notice) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: PAPER,
            color: INK,
            fontFamily: "Georgia, serif",
          }}
        >
          <div style={{ fontSize: 96, fontWeight: 700 }}>UNITED MEMEOSTAN</div>
          <div style={{ fontSize: 34, marginTop: 16, opacity: 0.7 }}>
            you write the laws. the state enforces them on you.
          </div>
          <div style={{ fontSize: 26, marginTop: 40, opacity: 0.5 }}>memeostan.xyz</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const skin = PALETTE[notice.kind];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          color: INK,
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Masthead */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: INK,
            color: PAPER,
            padding: "20px 48px",
          }}
        >
          <div style={{ fontSize: 28, letterSpacing: 4 }}>UNITED MEMEOSTAN</div>
          <div style={{ fontSize: 24, opacity: 0.75 }}>{skin.office}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "36px 48px", flex: 1 }}>
          {/* The verdict word, which is the whole point of the image */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                background: skin.accent,
                color: INK,
                padding: "10px 26px",
                fontSize: 62,
                fontWeight: 700,
                letterSpacing: 2,
                border: `6px solid ${INK}`,
              }}
            >
              {skin.label}
            </div>
          </div>

          {notice.article && (
            <div style={{ fontSize: 32, marginTop: 24, fontWeight: 700 }}>
              {clamp(notice.article, 72)}
            </div>
          )}

          {/* What the citizen actually posted */}
          <div
            style={{
              display: "flex",
              marginTop: 22,
              paddingLeft: 20,
              borderLeft: `8px solid ${INK}`,
              fontSize: 30,
              fontStyle: "italic",
              opacity: 0.85,
            }}
          >
            “{clamp(notice.post.text || "(a picture)", 150)}”
          </div>

          {/* What the office said back */}
          <div style={{ display: "flex", marginTop: 24, fontSize: 27, lineHeight: 1.35 }}>
            {clamp(notice.text, 260)}
          </div>

          {notice.penalty && (
            <div style={{ display: "flex", marginTop: 18, fontSize: 27, fontWeight: 700 }}>
              Penalty: {clamp(notice.penalty, 80)}
              {notice.benchVerdict ? "  ·  ruled from the bench" : ""}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `5px solid ${INK}`,
            padding: "18px 48px",
            fontSize: 26,
          }}
        >
          <div style={{ display: "flex" }}>@{clamp(notice.username, 28)}</div>
          <div style={{ display: "flex", opacity: 0.6 }}>memeostan.xyz</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // The state does not revise a verdict, so this is safe to cache hard.
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    }
  );
}
