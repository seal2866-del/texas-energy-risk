import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Texas Energy Risk Alert Platform",
  description:
    "Monitor ERCOT power prices, Texas weather demand risk, and natural gas market conditions. Informational only — not investment or trading advice.",
  keywords: ["ERCOT", "Texas energy", "power market", "natural gas", "risk monitoring"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0f1e] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
