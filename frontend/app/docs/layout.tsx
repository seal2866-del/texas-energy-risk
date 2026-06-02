"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { BookOpen, ChevronRight, Menu, Home, LayoutDashboard, Map, BarChart2, Bell, FileText, CheckSquare, HelpCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const COMPLIANCE = "TX Energy Risk provides operational intelligence and situational awareness only. The platform does not provide investment, trading, procurement, legal, engineering, or financial advice. Users remain responsible for all operational and business decisions.";

const NAV = [
  { href: "/docs",                  label: "Overview",               icon: Home },
  { href: "/docs/getting-started",  label: "Getting Started",        icon: BookOpen },
  { href: "/docs/dashboard",        label: "Dashboard Guide",        icon: LayoutDashboard },
  { href: "/docs/grid-map",         label: "Grid Map Guide",         icon: Map },
  { href: "/docs/analytics",        label: "Analytics Guide",        icon: BarChart2 },
  { href: "/docs/alerts",           label: "Alert Center",           icon: Bell },
  { href: "/docs/daily-brief",      label: "Energy Risk Brief",      icon: FileText },
  { href: "/docs/workflow",         label: "Daily Workflow",         icon: CheckSquare },
  { href: "/docs/faq",              label: "FAQ",                    icon: HelpCircle },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-72 bg-[#060c1a] border-r border-white/8 z-40 flex flex-col transition-transform duration-300 pt-16",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-white uppercase tracking-widest">Operational Intelligence Library</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">25 Articles · 8 Guides · Weekly Brief</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link key={href} href={href} onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-orange-500/15 text-orange-300 border border-orange-500/20"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5",
                )}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/5">
          <p className="text-[10px] text-gray-600 leading-relaxed">{COMPLIANCE}</p>
        </div>
      </aside>
    </>
  );
}

function Breadcrumbs() {
  const path = usePathname();
  const segments = path.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = NAV.find(n => n.href === href)?.label ?? seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return { href, label };
  });
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-6 flex-wrap">
      <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
      {crumbs.map(({ href, label }, i) => (
        <span key={href} className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3" />
          {i === crumbs.length - 1
            ? <span className="text-gray-300 font-medium">{label}</span>
            : <Link href={href} className="hover:text-gray-300 transition-colors">{label}</Link>
          }
        </span>
      ))}
    </nav>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#060c1a]">
      <Navbar />
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-72 pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <button onClick={() => setOpen(true)}
            className="lg:hidden flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            <Menu className="w-4 h-4" />Navigation
          </button>
          <Breadcrumbs />
          {children}
          <div className="mt-16 pt-8 border-t border-white/5">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/5">
              <Shield className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">{COMPLIANCE}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
