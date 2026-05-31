import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free, Pro & Business Plans",
  description:
    "Choose the right Texas Grid Intel plan for your operations. Free monitoring, Pro real-time alerts, or Business with PDF reports and API access. Starting at $0/month.",
  alternates: { canonical: "https://texasgridintel.com/pricing" },
  openGraph: {
    title: "Pricing — Texas Grid Intel",
    description: "ERCOT energy intelligence plans from $0 to $1,199/month. Real-time alerts, AI briefs, and operational reports for Texas energy teams.",
    url: "https://texasgridintel.com/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
