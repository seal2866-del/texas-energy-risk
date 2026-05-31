import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live ERCOT Dashboard — Real-Time Grid Intelligence",
  description:
    "Monitor live ERCOT power prices, Texas weather demand pressure, and natural gas supply conditions. Real-time risk scoring updated every 5 minutes.",
  alternates: { canonical: "https://texasgridintel.com/dashboard" },
  openGraph: {
    title: "Live ERCOT Dashboard — Texas Grid Intel",
    description: "Real-time ERCOT pricing, weather demand, and gas supply risk — updated every 5 minutes for Texas operations teams.",
    url: "https://texasgridintel.com/dashboard",
  },
  robots: { index: false, follow: false }, // dashboard requires auth — don't index
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
