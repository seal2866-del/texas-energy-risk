import Link from "next/link";
import Image from "next/image";

function FooterSection({ title, links }: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">{title}</h4>
      <div className="space-y-1.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            target={l.external ? "_blank" : undefined}
            rel={l.external ? "noopener noreferrer" : undefined}
            className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#06091a] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* ── Main grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">

          {/* Brand — spans 2 cols on md */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center mb-3">
              <Image
                src="/logo.png"
                alt="TX Energy Risk"
                width={500}
                height={280}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              Institutional-grade AI energy intelligence for Texas ERCOT market monitoring.
              Continuously tracking price volatility, weather demand, and gas supply risk.
            </p>
            {/* Operational status */}
            <div className="flex items-center gap-2 mt-4">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              <span className="text-[10px] text-gray-600 uppercase tracking-wide font-semibold">Systems Operational</span>
            </div>
          </div>

          <FooterSection title="Platform" links={[
            { label: "Dashboard",   href: "/dashboard" },
            { label: "Alerts",      href: "/alerts" },
            { label: "Pricing",     href: "/pricing" },
            { label: "Sign In",     href: "/login" },
          ]} />

          <FooterSection title="Intelligence" links={[
            { label: "Methodology",      href: "/terms#methodology" },
            { label: "Data Sources",     href: "/terms#data-sources" },
            { label: "AI Interpretation", href: "/terms#ai" },
            { label: "Signal Engine",    href: "/terms#signals" },
          ]} />

          <FooterSection title="Legal & Info" links={[
            { label: "Disclaimer & Terms", href: "/terms" },
            { label: "Data Usage Policy",  href: "/terms#data" },
            { label: "Contact",            href: "mailto:support@texasgridintel.com" },
            { label: "Status",             href: "/terms#status" },
          ]} />
        </div>

        {/* ── AI notice bar ─────────────────────────────────────────────── */}
        <div className="border-t border-white/5 pt-6 mb-5">
          <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/12 text-xs text-teal-300/60 leading-relaxed">
            <span className="font-semibold text-teal-400/70">AI Interpretation Notice:</span>{" "}
            AI-generated market reasoning is produced by Claude (Anthropic) and is provided for
            informational context only. AI analysis does not constitute professional investment,
            trading, procurement, or financial advice. AI outputs are probabilistic and may not
            reflect actual market conditions.
          </div>
        </div>

        {/* ── Bottom bar ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-600">
          <p>© {new Date().getFullYear()} Texas Grid Intel. All rights reserved.</p>
          <p className="leading-relaxed text-right max-w-md">
            Data provided for informational purposes only. Not investment, trading, financial, legal,
            or procurement advice. ERCOT, NOAA, and EIA data subject to source terms of use.
          </p>
        </div>

      </div>
    </footer>
  );
}
