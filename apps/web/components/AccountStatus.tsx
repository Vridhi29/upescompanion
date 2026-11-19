"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export function AccountStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    let authEventSeen = false;
    supabase.auth.getSession().then(({ data }) => {
      if (live && !authEventSeen) setEmail(data.session?.user.email ?? null);
    }).catch(() => {
      if (live && !authEventSeen) setEmail(null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      authEventSeen = true;
      setEmail(session?.user.email ?? null);
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [supabase]);

  if (email) {
    return (
      <div className="text-sm">
        <div className="truncate text-muted">{email}</div>
        <button onClick={() => supabase?.auth.signOut()} className="mt-1 font-medium text-accent underline-offset-2 hover:underline">
          Sign out
        </button>
      </div>
    );
  }
  return (
    <Link href="/login" className="text-sm font-medium text-accent underline-offset-2 hover:underline">
      Sign in
    </Link>
  );
}
