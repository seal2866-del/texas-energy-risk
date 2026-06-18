import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Disclaimer & Terms — Texas Energy Risk Alert Platform",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

          {/* Banner */}
          <div className="flex items-start gap-3 p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-10">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300 text-sm">Important: This Platform Is Informational Only</p>
              <p className="text-sm text-amber-200/70 mt-1 leading-relaxed">
                Nothing on this platform constitutes investment, trading, financial,
                or procurement advice. All content is for situational awareness purposes only.
              </p>
            </div>
          </div>

          <h1 className="text-3xl font-black text-white mb-2">Disclaimer & Terms of Use</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

          {[
            {
              title: "1. No Investment, Trading, or Procurement Advice",
              body: `The Texas Energy Risk Alert Platform ("Platform") provides data, signals, and risk indicators for informational and educational purposes only. Nothing on this Platform — including but not limited to risk scores, price data, weather risk classifications, natural gas signals, AI-generated summaries, or alert notifications — constitutes or should be construed as investment advice, trading advice, financial advice, or procurement advice of any kind.

The Platform may use language such as "risk may be rising" or "conditions may be shifting." This is informational language only. The Platform will never instruct users to "buy," "sell," "lock price," "hedge," or take any specific trading or procurement action.

Users should consult qualified financial advisors, energy traders, or procurement professionals before making any decisions.`,
            },
            {
              title: "2. Data Accuracy and Limitations",
              body: `Data displayed on this Platform is sourced from or modeled after publicly available feeds including ERCOT (Electric Reliability Council of Texas), the National Oceanic and Atmospheric Administration (NOAA)/National Weather Service (NWS), and the U.S. Energy Information Administration (EIA). This Platform is not affiliated with, endorsed by, or operated in partnership with any of these organizations.

Data may be delayed, incomplete, or inaccurate. Signal calculations are automated and probabilistic. Risk scores are derived from heuristic rules and may not reflect actual market conditions. Users should not rely solely on this Platform when assessing energy market risk.`,
            },
            {
              title: "3. Forward-Looking Signals and Uncertainty",
              body: `Risk signals and scores are based on historical patterns and real-time indicators. They are not predictions or guarantees of future market conditions. Energy markets in Texas are highly volatile and can change rapidly due to weather events, grid emergencies, supply disruptions, regulatory changes, and other factors that this Platform may not capture in real time.

Past signal performance does not guarantee future accuracy.`,
            },
            {
              title: "4. No Fiduciary Relationship",
              body: `Use of this Platform does not create any fiduciary, advisory, or professional relationship between you and the Platform operator. The Platform operator is not a registered investment advisor, commodity trading advisor, financial planner, or energy consultant.`,
            },
            {
              title: "5. Limitation of Liability",
              body: `To the maximum extent permitted by law, the Platform operator shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising out of your use of or reliance on this Platform, including but not limited to losses from energy procurement decisions, trading losses, or business interruption.`,
            },
            {
              title: "6. Subscription Terms",
              body: `Free tier accounts are provided at no cost and may be discontinued at any time. Pro subscriptions are billed monthly via Stripe. Subscriptions may be canceled at any time; access continues until the end of the current billing period. No partial refunds are provided for unused portions of a billing period unless required by applicable law.`,
            },
            {
              title: "7. Acceptable Use",
              body: `This Platform is intended for use by energy industry professionals, researchers, and interested parties for informational monitoring purposes. You agree not to use this Platform to make, recommend, or facilitate trading or procurement decisions for third parties in a manner that constitutes unlicensed financial advisory activity.`,
            },
            {
              title: "8. Changes to Terms",
              body: `These terms may be updated from time to time. Continued use of the Platform following notice of changes constitutes acceptance of the updated terms.`,
            },
          ].map(({ title, body }) => (
            <div key={title} className="mb-8">
              <h2 className="text-base font-bold text-white mb-3">{title}</h2>
              <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{body}</div>
            </div>
          ))}

          <div className="mt-12 p-6 rounded-xl bg-white/3 border border-white/8 text-center">
            <p className="text-sm text-gray-400">
              Questions? Contact us at{" "}
              <a href="mailto:support@texasgridintel.com" className="text-orange-400 hover:underline">
                support@texasgridintel.com
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
