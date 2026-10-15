import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import "../styles/globals.css";
import { Providers } from "./providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600"],
  axes: ["SOFT", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Ghost", template: "%s · Ghost" },
  description: "Ghost finds revenue you already earned, proves it with source records, and recovers it through Stripe.",
};

export const viewport: Viewport = {
  themeColor: "rgb(5 32 24)" // --color-forest,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn(GeistSans.variable, GeistMono.variable, fraunces.variable)}>
      <body className="min-h-dvh bg-canvas font-sans text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
