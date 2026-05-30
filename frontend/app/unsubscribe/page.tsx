"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

export default function UnsubscribePage() {
  const params = useSearchParams();
  const token  = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    const api = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";
    fetch(`${api}/api/newsletter/unsubscribe?token=${token}`)
      .then(r => setStatus(r.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {status === "loading" && (
          <p className="text-gray-400">Processing unsubscribe request...</p>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-white mb-2">You're unsubscribed.</h1>
            <p className="text-gray-400 text-sm mb-6">
              You've been removed from the Texas Energy Risk Brief.
              You won't receive further emails from this list.
            </p>
            <Link href="/" className="text-orange-400 hover:text-orange-300 text-sm font-semibold">
              Return to TX Energy Risk →
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-white mb-2">Link expired or invalid.</h1>
            <p className="text-gray-400 text-sm mb-6">
              This unsubscribe link may have already been used or is no longer valid.
            </p>
            <Link href="/" className="text-orange-400 hover:text-orange-300 text-sm font-semibold">
              Return to TX Energy Risk →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
