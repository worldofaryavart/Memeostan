"use client";

import Art from "./Art";

// Peak-Brainrot page hero. The landing page's giant art header, generalized so
// every in-world page leads with the same energy: crowned-brain mascot, a big
// title (PNG art with a poster-type fallback), and a hand-drawn tagline.
//
// Use `titleArt` for the wordmark image on the home/landing feel; pass plain
// `title` text for section pages (Government, Court, …) where a wordmark PNG
// doesn't exist — it renders as the Anton poster face with a hard drop-shadow.

export default function PageHero({
  kicker,
  title,
  titleArt,
  titleAccent,
  tagline,
  subtagline,
}: {
  kicker?: string;
  title: string;
  titleArt?: string;        // e.g. "/art/hero-title.png"
  titleAccent?: string;     // word in `title` to color lime (text mode only)
  tagline?: string;
  subtagline?: string;
}) {
  const renderTextTitle = () => {
    if (titleAccent && title.includes(titleAccent)) {
      const [before, after] = title.split(titleAccent);
      return (
        <h1 className="poster" style={heroTitleStyle}>
          {before}
          <span style={{ color: "var(--lime)" }}>{titleAccent}</span>
          {after}
        </h1>
      );
    }
    return <h1 className="poster" style={heroTitleStyle}>{title}</h1>;
  };

  return (
    <header style={{ textAlign: "center", margin: "8px 0 36px", position: "relative" }}>
      <div className="brandmark" style={{ display: "inline-flex", justifyContent: "center", marginBottom: 12 }}>
        <Art
          src="/art/mascot-brain.png"
          alt="United Memeostan mascot"
          fallback={<span style={{ fontSize: 56 }}>🧠</span>}
          style={{ width: 84, height: 84, objectFit: "contain", transform: "rotate(-5deg)", filter: "drop-shadow(4px 4px 0 #000)" }}
        />
      </div>

      {kicker && (
        <div style={{ marginBottom: 10 }}>
          <span className="kicker" style={{ display: "inline-block" }}>{kicker}</span>
        </div>
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
        {titleArt ? (
          <Art
            src={titleArt}
            alt={title}
            fallback={renderTextTitle()}
            style={{ width: "100%", maxWidth: 620, height: "auto", display: "block", margin: "0 auto", filter: "drop-shadow(4px 4px 0 #000)" }}
          />
        ) : (
          renderTextTitle()
        )}
      </div>

      {tagline && (
        <p className="hand" style={{ fontSize: 26, color: "var(--pink)", marginTop: 14, lineHeight: 1.25 }}>
          {tagline}
        </p>
      )}
      {subtagline && (
        <p className="hand" style={{ fontSize: 16, color: "var(--bone)", marginTop: 4, opacity: 0.85 }}>
          {subtagline}
        </p>
      )}
    </header>
  );
}

const heroTitleStyle: React.CSSProperties = {
  fontSize: "clamp(34px, 6vw, 60px)",
  lineHeight: 0.95,
  textTransform: "uppercase",
  color: "#fff",
  filter: "drop-shadow(4px 4px 0 #000)",
};
