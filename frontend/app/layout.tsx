import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

const SITE_URL = "https://texasgridintel.com";
const SITE_NAME = "Texas Grid Intel";
const SITE_DESCRIPTION =
  "Real-time ERCOT energy intelligence for Texas operations. Monitor ERCOT power prices, weather demand risk, and Henry Hub natural gas supply conditions before they impact your business. Email and SMS alerts when risk changes.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Texas Grid Intel — Real-Time ERCOT Energy Intelligence & Risk Alerts",
    template: "%s | Texas Grid Intel",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "ERCOT energy intelligence", "Texas energy risk monitor", "ERCOT price alert",
    "Texas grid risk", "ERCOT real-time pricing", "Texas energy procurement intelligence",
    "ERCOT market risk alerts", "HB Houston price", "texas electricity demand risk",
    "Henry Hub price monitor", "natural gas supply Texas", "ERCOT power prices today",
    "Texas energy monitoring", "energy risk platform Texas", "ERCOT price spike alert",
    "Texas grid operator data", "energy procurement Texas", "ERCOT hb houston",
    "Texas operations energy cost", "grid intelligence Texas", "ERCOT load zone",
  ],
  authors: [{ name: "Texas Grid Intel", url: SITE_URL }],
  creator: "Texas Grid Intel",
  publisher: "Texas Grid Intel",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Texas Grid Intel — Real-Time ERCOT Energy Intelligence & Risk Alerts",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Texas Grid Intel — ERCOT Energy Intelligence Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Texas Grid Intel — Real-Time ERCOT Energy Intelligence & Risk Alerts",
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
    creator: "@texasgridintel",
  },
  verification: {
    google: "OEjZ_NTVicLfTYNUqro7o5NdpcQVlBjDRFcxl5dow_M",
  },
  category: "energy",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/dashboard` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
        width: 200,
        height: 60,
      },
      sameAs: [],
      contactPoint: {
        "@type": "ContactPoint",
        email: "support@texasgridintel.com",
        contactType: "customer support",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      featureList: [
        "Real-time ERCOT HB_HOUSTON price monitoring every 5 minutes",
        "Texas weather demand risk scoring across 8 cities",
        "Henry Hub natural gas price tracking",
        "AI-powered energy risk analysis and 48-hour outlook",
        "Email and SMS alerts on risk level change",
        "Texas ERCOT zone risk map across 8 monitored cities",
        "Predictive 48-hour risk intelligence",
        "Morning energy briefing digest",
        "Historical ERCOT pattern analysis",
        "Escalation alert system for unacknowledged High risk",
      ],
      offers: [
        {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          name: "Free",
          description: "Live ERCOT dashboard with basic risk monitoring",
        },
        {
          "@type": "Offer",
          price: "499",
          priceCurrency: "USD",
          name: "Pro",
          billingPeriod: "P1M",
          description: "Full intelligence suite with email and SMS alerts, AI reasoning, and export",
        },
        {
          "@type": "Offer",
          price: "1199",
          priceCurrency: "USD",
          name: "Business",
          billingPeriod: "P1M",
          description: "Enterprise energy intelligence with morning digest and multi-location monitoring",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Texas Grid Intel?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Texas Grid Intel is a real-time ERCOT energy intelligence platform that monitors Texas power prices, weather demand risk, and natural gas supply conditions — alerting operations and procurement teams before energy costs spike.",
          },
        },
        {
          "@type": "Question",
          name: "How often does ERCOT price data update?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Texas Grid Intel fetches live ERCOT HB_HOUSTON settlement point prices every 5 minutes directly from the ERCOT CDR — the same real-time source ERCOT publishes for market participants.",
          },
        },
        {
          "@type": "Question",
          name: "Which Texas cities are monitored?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Texas Grid Intel monitors energy risk for 8 Texas cities: Houston, Dallas, Austin, San Antonio, Midland, Odessa, Corpus Christi, and Lubbock — covering all major ERCOT load zones.",
          },
        },
        {
          "@type": "Question",
          name: "When do risk alerts fire?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Alerts fire immediately when risk level changes — Low to Medium, Medium to High, or any shift depending on your threshold setting. Email and SMS delivery happens within seconds of detection.",
          },
        },
        {
          "@type": "Question",
          name: "What data sources does Texas Grid Intel use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Texas Grid Intel uses three live data sources: ERCOT CDR for real-time power prices, NOAA/NWS for Texas weather forecasts and demand risk, and EIA for weekly natural gas storage reports and Henry Hub pricing.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-screen text-white antialiased">
        {children}
      </body>
    </html>
  );
}
