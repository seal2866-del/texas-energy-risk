import { MetadataRoute } from "next";

const SITE_URL = "https://texasgridintel.com";
const now = new Date();

const PAGES = [
  // Core
  ["/", "daily", 1.0], ["/dashboard", "always", 0.9], ["/pricing", "weekly", 0.8],
  ["/map", "daily", 0.8], ["/analytics", "daily", 0.7], ["/alerts", "weekly", 0.7],
  // City pages
  ["/houston-energy-risk", "weekly", 0.9],
  ["/midland-energy-risk", "weekly", 0.9],
  ["/odessa-energy-risk", "weekly", 0.9],
  ["/corpus-christi-energy-risk", "weekly", 0.9],
  ["/dallas-energy-risk", "weekly", 0.9],
  // Industry pages
  ["/oil-gas-energy-risk", "weekly", 0.9],
  ["/midstream-risk-monitoring", "weekly", 0.9],
  ["/industrial-energy-risk", "weekly", 0.9],
  ["/datacenter-power-risk", "weekly", 0.9],
  // Blog index
  ["/blog", "weekly", 0.8],
  // Blog articles
  ["/blog/ercot-price-spikes", "monthly", 0.7],
  ["/blog/texas-summer-energy-risk", "monthly", 0.7],
  ["/blog/henry-hub-ercot", "monthly", 0.7],
  ["/blog/permian-basin-energy-risk", "monthly", 0.7],
  ["/blog/texas-energy-alerts-setup", "monthly", 0.7],
  ["/blog/ercot-reserve-margin-explained", "monthly", 0.7],
  ["/blog/texas-winter-energy-risk", "monthly", 0.7],
  ["/blog/natural-gas-storage-ercot", "monthly", 0.7],
  ["/blog/houston-energy-procurement-guide", "monthly", 0.7],
  ["/blog/ercot-price-forecast-week", "monthly", 0.7],
  ["/blog/data-center-texas-energy-risk", "monthly", 0.7],
  ["/blog/ercot-demand-response-operations", "monthly", 0.7],
  ["/blog/midland-odessa-energy-outlook", "monthly", 0.7],
  ["/blog/henry-hub-price-monitor-guide", "monthly", 0.7],
  ["/blog/ercot-congestion-guide", "monthly", 0.7],
  ["/blog/texas-grid-reliability-outlook", "monthly", 0.7],
  ["/blog/energy-procurement-best-practices", "monthly", 0.7],
  ["/blog/weather-demand-risk-texas", "monthly", 0.7],
  ["/blog/operational-energy-intelligence", "monthly", 0.7],
  // Docs
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
