import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

const SITE_URL = "https://texasgridintel.com";
const SITE_NAME = "Texas Grid Intel";
const SITE_DESCRIPTION =
  "Real-time ERCOT power grid intelligence for Texas operations. Monitor energy prices, weather demand risk, and natural gas supply conditions before they impact your business.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Texas Grid Intel — ERCOT Energy Intelligence Platform",
    template: "%s | Texas Grid Intel",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "ERCOT", "Texas energy", "power grid", "natural gas", "energy risk",
    "Texas energy market", "ERCOT pricing", "grid intelligence", "energy monitoring",
    "Texas operations", "energy procurement", "power market", "energy trading",
    "grid risk", "Texas electricity", "energy cost", "demand forecasting",
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
    title: "Texas Grid Intel — ERCOT Energy Intelligence Platform",
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
    title: "Texas Grid Intel — ERCOT Energy Intelligence Platform",
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
    creator: "@texasgridintel",
  },
  verification: {
    google: "",   // add Google Search Console verification token here
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
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
        { "@type": "Offer", price: "499", priceCurrency: "USD", name: "Pro", billingPeriod: "P1M" },
        { "@type": "Offer", price: "1199", priceCurrency: "USD", name: "Business", billingPeriod: "P1M" },
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
