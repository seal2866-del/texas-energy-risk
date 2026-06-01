import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Energy Risk Monitoring Plans — Texas Grid Intel Pricing",
  description:
    "From free ERCOT monitoring to enterprise intelligence. Get real-time Texas energy risk alerts via email and SMS, AI market analysis, and morning briefings. Plans from free to $1,199/month.",
  keywords: ["ERCOT alert pricing", "Texas energy monitoring plans", "energy risk platform cost"],
  alternates: { canonical: "https://texasgridintel.com/pricing" },
  openGraph: {
    title: "Energy Risk Monitoring Plans — Texas Grid Intel",
    description: "ERCOT energy intelligence from $0 to $1,199/month. Real-time alerts, AI risk analysis, and operational reports for Texas energy teams.",
    url: "https://texasgridintel.com/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
