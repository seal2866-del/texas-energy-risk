import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Texas Energy Analytics — Historical ERCOT Patterns & Predictive Intelligence",
  description:
    "Analyze historical ERCOT risk patterns, state transitions, and 48-hour predictive outlooks for Texas energy conditions. Pattern recognition across Houston, Dallas, Austin, San Antonio, and 4 more Texas cities.",
  keywords: ["ERCOT historical analysis", "Texas energy analytics", "predictive energy risk", "ERCOT pattern recognition", "Texas grid history"],
  alternates: { canonical: "https://texasgridintel.com/analytics" },
  openGraph: {
    title: "Texas Energy Analytics — Texas Grid Intel",
    description: "Historical ERCOT patterns, state transition analysis, and AI-powered 48-hour risk forecasts across 8 Texas cities.",
    url: "https://texasgridintel.com/analytics",
  },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
