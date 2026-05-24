"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const isSignup     = searchParams.get("signup") === "true";

  const [mode,     setMode]     = useState<"signin" | "signup">(isSignup ? "signup" : "signin");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setSuccess("Account created! Check your email to confirm, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-10">
        <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
          <Zap className="w-5 h-5 text-orange-400" />
        </div>
        <span className="font-bold text-white text-lg">TX Energy Risk</span>
      </Link>

      <div className="card-glass border border-white/8 w-full max-w-md p-8">
        {/* Mode toggle */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-8">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); setSuccess(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m
                  ? "bg-orange-500 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {m === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <h1 className="text-xl font-black text-white mb-1">
          {mode === "signin" ? "Welcome back" : "Get started free"}
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          {mode === "signin"
            ? "Sign in to your energy risk dashboard."
            : "Monitor Texas energy risk conditions — free tier available."}
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm mb-5">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/8 transition-all text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/8 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/8 transition-all text-sm pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm mt-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "signin" ? "Sign In" : "Create Free Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-600">
          By continuing you agree to our{" "}
          <Link href="/terms" className="text-gray-400 hover:text-white underline">
            Terms & Disclaimer
          </Link>
          . This platform provides informational data only.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
