"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Bell, LogOut, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [user,      setUser]      = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) =>
      setUser(session?.user ?? null)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const navLinks = user
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/map",       label: "Grid Map" },
        { href: "/analytics", label: "Analytics" },
        { href: "/alerts",    label: "Alerts" },
        { href: "/docs",      label: "Help" },
        { href: "/pricing",   label: "Upgrade" },
      ]
    : [
        { href: "/pricing", label: "Pricing" },
        { href: "/docs",    label: "Help Center" },
        { href: "/terms",   label: "Disclaimer" },
      ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/8 bg-[#080d1c]/92 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between h-28">

          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="TX Energy Risk"
              width={500}
              height={280}
              className="h-24 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  pathname === l.href
                    ? "text-orange-400"
                    : "text-gray-400 hover:text-white"
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link href="/alerts" className="relative p-2 text-gray-400 hover:text-white transition-colors">
                  <Bell className="w-5 h-5" />
                </Link>
                <Link href="/account" className="p-2 text-gray-400 hover:text-white transition-colors" title="Account Settings">
                  <Settings className="w-5 h-5" />
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/login?signup=true"
                  className="px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0d1428] border-t border-white/5 px-4 py-4 space-y-3">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-sm font-medium text-gray-300 hover:text-white"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/account" className="block text-sm text-gray-300 hover:text-white" onClick={() => setMenuOpen(false)}>
                Account Settings
              </Link>
              <button onClick={handleSignOut} className="block text-sm text-gray-400 hover:text-white">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="block text-sm text-orange-400 font-semibold">Sign in / Sign up
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
