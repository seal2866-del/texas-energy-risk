import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, LayoutDashboard, Map, BarChart2, Bell, FileText, CheckSquare, HelpCircle, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Help Center — TX Energy Risk Documentation",
  description: "Documentation, guides, and reference for TX Energy Risk operational intelligence platform.",
};

const GUIDES = [
  { href: "/docs/getting-started",  icon: BookOpen,       title: "Getting Started",        desc: "What TX Energy Risk is, who it is for, and what to expect." },
  { href: "/docs/dashboard",        icon: LayoutDashboard, title: "Dashboard Guide",        desc: "Every major component explained — risk score, recommendations, scenarios." },
  { href: "/docs/grid-map",         icon: Map,             title: "Grid Map Guide",         desc: "8 Texas cities monitored. How to read risk indicators and trends." },
  { href: "/docs/analytics",        icon: BarChart2,       title: "Analytics Guide",        desc: "Predictive outlook, trajectory, pattern memory, and transition analysis." },
  { href: "/docs/alerts",           icon: Bell,            title: "Alert Center",           desc: "Email, SMS, Teams, and Slack alerts. Thresholds and frequencies." },
  { href: "/docs/daily-brief",      icon: FileText,        title: "Energy Risk Brief",      desc: "The executive morning briefing — how to read and act on it." },
  { href: "/docs/workflow",         icon: CheckSquare,     title: "Daily Workflow",         desc: "A 5-minute daily process for operational awareness." },
  { href: "/docs/faq",              icon: HelpCircle,      title: "Frequently Asked",       desc: "Data sources, accuracy, compliance, and common questions." },
];

export default function DocsIndex() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white mb-3">TX Energy Risk Help Center</h1>
        <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">
          Everything you need to get operational value from TX Energy Risk — from first login
          to advanced analytics and alert configuration.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GUIDES.map(({ href, icon: Icon, title, desc }) => (
          <Link key={href} href={href}
            className="group flex items-start gap-4 p-5 rounded-2xl bg-white/3 border border-white/8 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-bold text-white">{title}</h2>
                <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-orange-400 transition-colors" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-8 p-5 rounded-2xl bg-teal-500/5 border border-teal-500/15">
        <p className="text-sm font-semibold text-teal-300 mb-1">New to TX Energy Risk?</p>
        <p className="text-sm text-gray-400">Start with <Link href="/docs/getting-started" className="text-orange-400 hover:text-orange-300 underline">Getting Started</Link>, then follow the <Link href="/docs/workflow" className="text-orange-400 hover:text-orange-300 underline">Daily Workflow</Link> guide to build your 5-minute monitoring routine.</p>
      </div>
    </div>
  );
}
