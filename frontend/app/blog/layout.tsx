import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

export const metadata: Metadata = {
  title: { default: "Texas Energy Risk Intelligence Blog", template: "%s | TX Energy Risk" },
  description: "ERCOT market analysis, Texas energy risk guides, natural gas intelligence, and operational procurement insights from TX Energy Risk.",
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#060c1a] pt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
