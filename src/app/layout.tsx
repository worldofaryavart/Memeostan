import type { Metadata } from "next";
import "./globals.css";
import NationWrapper from "@/components/NationWrapper";

export const metadata: Metadata = {
  title: "🌐 United Memeostan",
  description:
    "A brainrot nation that actually works. One World. One Meme.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NationWrapper>{children}</NationWrapper>
      </body>
    </html>
  );
}

