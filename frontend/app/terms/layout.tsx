import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer, Terms & Methodology",
  description:
    "Texas Grid Intel data sources, AI methodology, signal engine documentation, and legal disclaimer. Data sourced from ERCOT, NOAA, and EIA public feeds.",
  alternates: { canonical: "https://texasgridintel.com/terms" },
  openGraph: {
    title: "Disclaimer & Terms — Texas Grid Intel",
    description: "Data methodology, AI interpretation notice, and legal disclaimer for Texas Grid Intel.",
    url: "https://texasgridintel.com/terms",
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
