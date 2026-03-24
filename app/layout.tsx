import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalShot™ — Turn Signals Into Smarter Marketing Decisions",
  description: "Discover your ideal customer, build your marketing strategy, and execute with precision — powered by Alex.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-body">
        {children}
      </body>
    </html>
  );
}
