import { MetadataRoute } from "next";

const SITE_URL = "https://texasgridintel.com";
const now = new Date();

const PAGES = [
  ["/", "daily", 1.0], ["/dashboard", "always", 0.9], ["/pricing", "weekly", 0.8],
  ["/map", "daily", 0.8], ["/analytics", "daily", 0.7], ["/alerts", "weekly", 0.7],
  ["/blog", "weekly", 0.8],
  ["/blog/ercot-price-spikes", "monthly", 0.7],
  ["/blog/texas-summer-energy-risk", "monthly", 0.7],
  ["/blog/henry-hub-ercot", "monthly", 0.7],
  ["/blog/permian-basin-energy-risk", "monthly", 0.7],
  ["/blog/texas-energy-alerts-setup", "monthly", 0.7],
  ["/docs", "weekly", 0.7],
  ["/docs/getting-started", "monthly", 0.6], ["/docs/dashboard", "monthly", 0.6],
  ["/docs/grid-map", "monthly", 0.6], ["/docs/analytics", "monthly", 0.6],
  ["/docs/alerts", "monthly", 0.6], ["/docs/daily-brief", "monthly", 0.6],
  ["/docs/workflow", "monthly", 0.6], ["/docs/faq", "monthly", 0.6],
  ["/login", "monthly", 0.5], ["/terms", "monthly", 0.3],
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(([path, freq, pri]) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: freq,
    priority: pri,
  }));
}
