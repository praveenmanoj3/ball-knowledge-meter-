import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BallKnowledgeMeter — Live Quiz Platform",
  description: "Interactive live quiz and presentation platform for up to 200 participants. Create quizzes, join with a code, compete in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
