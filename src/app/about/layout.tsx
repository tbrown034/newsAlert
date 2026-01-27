import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about News Pulse, how our intelligence ranking system works, AI transparency, and the team behind it.",
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
