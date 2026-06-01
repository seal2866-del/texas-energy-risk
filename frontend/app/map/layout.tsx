import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Texas ERCOT Zone Risk Map — Live Grid Intelligence",
  description:
    "Live risk status across all 8 Texas ERCOT zones. Houston, Dallas, Austin, San Antonio, Midland, Odessa, Corpus Christi, and Lubbock — ERCOT energy risk monitored in real time.",
  keywords: ["ERCOT zone map", "Texas grid risk by city", "ERCOT load zone status", "Texas energy risk map", "HB Houston risk", "LZ North risk"],
  alternates: { canonical: "https://texasgridintel.com/map" },
  openGraph: {
    title: "Texas ERCOT Zone Risk Map — Texas Grid Intel",
    description: "Real-time ERCOT risk across Houston, Dallas, Austin, San Antonio, Midland, Odessa, Corpus Christi, and Lubbock. Live grid intelligence for all Texas load zones.",
    url: "https://texasgridintel.com/map",
  },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
