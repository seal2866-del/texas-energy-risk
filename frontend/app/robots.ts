import { MetadataRoute } from "next";

const SITE_URL = "https://texasgridintel.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/dashboard", "/pricing", "/alerts", "/terms", "/login"],
        disallow: ["/admin/", "/prospecting/", "/api/", "/_next/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
