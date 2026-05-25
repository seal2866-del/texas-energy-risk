import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#080d1a] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center mb-3">
              <Image
                src="/logo.png"
                alt="TX Energy Risk"
                width={500}
                height={280}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Informational market monitoring for Texas energy buyers,
              operators, and investors.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Platform
            </h4>
            <div className="space-y-2">
              {[
                { href: "/dashboard", label: "Dashboard" },
                { href: "/alerts",    label: "Alerts" },
                { href: "/pricing",   label: "Pricing" },
                { href: "/login",     label: "Sign in" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Legal
            </h4>
            <div className="space-y-2">
              <Link href="/terms" className="block text-sm text-gray-500 hover:text-gray-300 transition-colors">
                Disclaimer & Terms
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-600 leading-relaxed">
              Data provided for informational purposes only. Not investment,
              trading, or procurement advice.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} Texas Energy Risk Alert Platform. All rights reserved.
          </p>
          <p className="text-xs text-gray-700">
            Not affiliated with ERCOT, NOAA, or EIA.
          </p>
        </div>
      </div>
    </footer>
  );
}
