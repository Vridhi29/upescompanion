"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api-client";

type ScheduledAssignment = {
  id: string;
  title: string;
  course: string;
  due: string;
  alarm: string;
  reminders?: string[];
  priority: "Normal" | "High" | "Urgent";
  status: "Open" | "In progress" | "Completed" | "Overdue";
};

type ActiveReminder = ScheduledAssignment & { storageKey: string; scope: string };

export function ReminderRuntime() {
  const [scope, setScope] = useState("device");
  const [authReady, setAuthReady] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [active, setActive] = useState<ActiveReminder | null>(null);
  const [actionError, setActionError] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const dialogRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef("device");
  const alertedRef = useRef(new Set<string>());
  const removedAssignmentIdsRef = useRef(new Set<string>());
  const storageKey = `upes:${scope}:assignments`;
  const settingsKey = `upes:${scope}:notification-settings`;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setAuthReady(true); setPreferencesReady(true); return; }
    let live = true;
    let authEventSeen = false;
    const updateScope = (userId?: string) => {
      const next = userId ?? "device";
      scopeRef.current = next;
      setScope(next);
      if (next === "device") { setPreferencesReady(true); return; }
      setPreferencesReady(false);
      apiRequest<{ preferences: { quietStart: string | null; quietEnd: string | null; reminderOffsetsMinutes: number[]; channels: string[] } | null }>("/v1/notification-preferences")
        .then(({ preferences }) => {
          if (!live || scopeRef.current !== next || !preferences) return;
          const key = `upes:${next}:notification-settings`;
          let current: Record<string, unknown> = {};
          try { current = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>; } catch {}
          localStorage.setItem(key, JSON.stringify({
            ...current,
            browser: preferences.channels.includes("local") || preferences.channels.includes("web_push"),
            quietStart: preferences.quietStart ?? "",
            quietEnd: preferences.quietEnd ?? "",
            offsets: preferences.reminderOffsetsMinutes.join(","),
          }));
        })
        .catch(() => undefined)
        .finally(() => { if (live && scopeRef.current === next) setPreferencesReady(true); });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (live && !authEventSeen) { updateScope(data.session?.user.id); setAuthReady(true); }
    }).catch(() => {
      if (live && !authEventSeen) { updateScope(); setAuthReady(true); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      authEventSeen = true;
      updateScope(session?.user.id);
      setAuthReady(true);
      setActive(null);
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const onAssignmentsUpdated = (event: Event) => {
      const ids = (event as CustomEvent<{ removedIds?: unknown }>).detail?.removedIds;
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id === "string") removedAssignmentIdsRef.current.add(`${scopeRef.current}:${id}`);
        }
      }
    };
    window.addEventListener("upes:assignments-updated", onAssignmentsUpdated);
    return () => window.removeEventListener("upes:assignments-updated", onAssignmentsUpdated);
  }, []);

  useEffect(() => {
    if (!authReady || !preferencesReady) return;
    setActive(null);
    const check = () => {
      if (scopeRef.current !== scope) return;
      let assignments: ScheduledAssignment[] = [];
      let preferences: { browser?: boolean; quietStart?: string; quietEnd?: string } = {};
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(stored)) assignments = stored.filter(isScheduledAssignment);
      } catch {}
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(settingsKey) ?? "{}");
        if (stored && typeof stored === "object") preferences = stored as typeof preferences;
      } catch {}
      if (isQuietHours(preferences.quietStart, preferences.quietEnd)) return;
      const now = Date.now();
      const reminder = assignments.find((item) => {
        const alarmAt = Date.parse(item.alarm);
        if (removedAssignmentIdsRef.current.has(`${scope}:${item.id}`) || !item.alarm || !Number.isFinite(alarmAt) || item.status === "Completed" || alarmAt > now) return false;
        const key = `alerted:${scope}:${item.id}:${item.alarm}`;
        if (alertedRef.current.has(key)) return false;
        try { if (sessionStorage.getItem(key)) return false; } catch {}
        return true;
      });
      if (!reminder) return;
      const alertKey = `alerted:${scope}:${reminder.id}:${reminder.alarm}`;
      alertedRef.current.add(alertKey);
      try { sessionStorage.setItem(alertKey, "1"); } catch {}
      if (preferences.browser !== false && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(`Reminder · ${reminder.title}`, {
            body: `${reminder.course || "Assignment"} · Due ${reminder.due ? new Date(reminder.due).toLocaleString() : "date not set"}`,
          });
        } catch {}
      }
      setActionError("");
      setActive({ ...reminder, storageKey, scope });
    };
    check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [authReady, preferencesReady, scope, settingsKey, storageKey]);

  useEffect(() => {
    if (!active || active.storageKey !== storageKey) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusDialog = dialog;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const portal = document.getElementById("portal-content");
    const wasInert = portal?.inert ?? false;
    if (portal) portal.inert = true;
    dialog.querySelector<HTMLElement>("button:not(:disabled)")?.focus();

    function containTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = focusDialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        focusDialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !focusDialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !focusDialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", containTab);
    return () => {
      document.removeEventListener("keydown", containTab);
      if (portal) portal.inert = wasInert;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [active, storageKey]);

  useEffect(() => {
    if (!active || active.storageKey !== storageKey) return;
    setClock(new Date());
    const timer = window.setInterval(() => setClock(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [active?.id, active?.storageKey, storageKey]);

  function close(snooze: boolean) {
    if (!active || scopeRef.current !== active.scope) {
      setActive(null);
      return;
    }
    const now = Date.now();
    const alarmAt = snooze ? localDateTime(new Date(now + 10 * 60_000)) : "";
    let updated: ScheduledAssignment[];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(active.storageKey) ?? "[]");
      const assignments = Array.isArray(stored) ? stored.filter(isScheduledAssignment) : [];
      updated = assignments.map((item) => {
        if (item.id !== active.id) return item;
        if (snooze) return { ...item, alarm: alarmAt, reminders: (item.reminders ?? []).filter((time) => Date.parse(time) > now + 10 * 60_000) };
        const reminders = (item.reminders ?? []).filter((time) => Date.parse(time) > now);
        return { ...item, alarm: reminders[0] ? localDateTime(new Date(reminders[0])) : "", reminders: reminders.slice(1) };
      });
      localStorage.setItem(active.storageKey, JSON.stringify(updated));
    } catch { setActionError("Could not save this reminder change on the device. Try again before dismissing the alarm."); return; }
    window.dispatchEvent(new Event("upes:assignments-updated"));
    setActive(null);
  }

  if (!active || active.storageKey !== storageKey) return null;
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="runtime-alarm-title" tabIndex={-1} className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-hidden bg-[#08090d] p-6 text-white">
    <div aria-hidden className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(135deg,transparent 35%,rgba(255,255,255,.1) 35.2%,transparent 35.4%),linear-gradient(45deg,transparent 65%,rgba(255,255,255,.08) 65.2%,transparent 65.4%)" }} />
    <div className="relative mx-auto w-full max-w-md text-center">
      <div className="eyebrow text-white/45">Assignment reminder · {active.priority}</div>
      <h2 id="runtime-alarm-title" className="mt-8 text-4xl font-semibold tracking-[-.05em]">{active.title}</h2>
      <p className="mt-3 text-sm text-white/55">{active.course || "Study time"}</p>
      <div className="mt-14 text-7xl font-light tracking-[-.07em]">{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      <p className="mt-2 text-xs text-white/45">{clock.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
      <div className="mt-12 grid grid-cols-2 gap-3">
        <button onClick={() => close(true)} className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/10">Snooze 10 min</button>
        <button onClick={() => close(false)} className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-black">Dismiss</button>
      </div>
      {actionError&&<p role="alert" className="mt-4 text-sm text-amber-200">{actionError}</p>}
      <p className="mt-6 text-xs text-white/35">The portal must remain open for reminders.</p>
    </div>
  </div>;
}

function isScheduledAssignment(value: unknown): value is ScheduledAssignment {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ScheduledAssignment>;
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.course === "string" &&
    typeof item.due === "string" && typeof item.alarm === "string" &&
    ["Normal", "High", "Urgent"].includes(item.priority ?? "") &&
    ["Open", "In progress", "Completed", "Overdue"].includes(item.status ?? "");
}

function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function isQuietHours(start?: string, end?: string) {
  if (!start || !end || start === end) return false;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const from = (startHour ?? 0) * 60 + (startMinute ?? 0);
  const to = (endHour ?? 0) * 60 + (endMinute ?? 0);
  return from < to ? current >= from && current < to : current >= from || current < to;
}
