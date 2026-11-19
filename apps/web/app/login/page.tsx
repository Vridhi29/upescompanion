"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const supabase = getSupabase();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-8 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
      <section className="hero-grid relative isolate overflow-hidden rounded-[1.6rem] bg-[#111] p-7 text-white sm:p-10 lg:min-h-[26rem] lg:content-end">
        <div aria-hidden className="absolute -right-12 -top-14 -z-10 h-64 w-64 rotate-45 border border-white/10" />
        <div className="eyebrow text-white/50">UPES · Student portal</div>
        <h1 className="mt-8 max-w-lg text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Your academic life,<br/>in one place.</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-white/60">Sign in with a secure email link to access your companion portal.</p>
      </section>
      <section className="mx-auto w-full max-w-md space-y-6 py-3">
      <div>
        <div className="eyebrow text-muted">Welcome back</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h2>
      </div>
      {!supabase ? (
        <p role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
          Sign-in is not set up yet. Add your Supabase URL and anon key to <code>apps/web/.env.local</code> (see the README), then restart the dev server.
        </p>
      ) : state === "sent" ? (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-900">We sent a sign-in link to <strong>{email}</strong>. Open it on this device to finish signing in.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-rule bg-white px-3.5 py-2.5 shadow-sm shadow-black/[.02]"
            />
          </label>
          <button
            disabled={state === "sending"}
            className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {state === "sending" ? "Sending link" : "Email me a sign-in link"}
          </button>
          {state === "error" && <p role="alert" className="text-danger">{message}</p>}
        </form>
      )}
      <p className="border-t border-rule pt-5 text-sm leading-6 text-muted">
        You sign in to this app only. It never asks for your UPES password.
      </p>
      </section>
    </div>
  );
}
