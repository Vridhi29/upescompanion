import { DEFAULT_TARGETS, type AlertLevel } from "@upes/core";
import { attendanceSourceLabel, statusWord, verdict, type SubjectView } from "@/lib/attendance-view";
import type { SubjectAttendanceSummary } from "@upes/core";

const SCALE_MIN = 50;
const pos = (p: number) => `${(Math.min(100, Math.max(SCALE_MIN, p)) - SCALE_MIN) * 2}%`;

const barColor: Record<AlertLevel, string> = {
  ok: "bg-safe",
  below_personal: "bg-warn",
  approaching_minimum: "bg-warn",
  below_minimum: "bg-danger",
  no_data: "bg-rule",
};
const textColor: Record<AlertLevel, string> = {
  ok: "text-safe",
  below_personal: "text-warn",
  approaching_minimum: "text-warn",
  below_minimum: "text-danger",
  no_data: "text-muted",
};

function Ticks({ personal }: { personal: number }) {
  const marks = [DEFAULT_TARGETS.minimum, DEFAULT_TARGETS.buffer, personal];
  return (
    <>
      {[...new Set(marks)].map((t) => (
        <span key={t} aria-hidden className="absolute -bottom-1 -top-1 w-px bg-ink/45" style={{ left: pos(t) }} />
      ))}
    </>
  );
}

/** Column header that labels the scale once, above the list. */
export function RulerAxis({ personal }: { personal: number }) {
  const marks = [...new Set([DEFAULT_TARGETS.minimum, DEFAULT_TARGETS.buffer, personal])];
  return (
    <div className="hidden items-end gap-6 border-b border-rule pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[.12em] text-muted sm:grid sm:grid-cols-[12rem_1fr_11rem] lg:grid-cols-[14rem_1fr_13rem]">
      <span>Subject</span>
      <div className="relative h-4" aria-hidden>
        <span className="absolute left-0">{SCALE_MIN}%</span>
        {marks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 text-ink" style={{ left: pos(t) }}>{t}</span>
        ))}
        <span className="absolute right-0">100%</span>
      </div>
      <span>What it means</span>
    </div>
  );
}

export function AttendanceRuler({
  name, code, s, personal, emphasis = false,
}: {
  name: string;
  code?: string;
  s: SubjectAttendanceSummary | SubjectView;
  personal: number;
  emphasis?: boolean;
}) {
  const pct = s.percentage;
  const label = pct === null ? "no data" : `${pct.toFixed(1)}%`;
  const sourceLabel = "source" in s ? attendanceSourceLabel(s.source) : null;
  return (
    <div className={`grid items-center gap-x-4 gap-y-3 border-b border-rule py-5 sm:grid-cols-[12rem_1fr_11rem] sm:gap-x-6 lg:grid-cols-[14rem_1fr_13rem] ${emphasis ? "py-6" : ""}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2"><div className={emphasis ? "text-xl font-semibold" : "font-medium"}>{name}</div>{sourceLabel && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">{sourceLabel}</span>}</div>
        <div className="text-sm text-muted">
          {s.counts.attended} of {s.counts.conducted} classes attended{code ? `, ${code}` : ""}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          role="img"
          aria-label={`${name}: ${label} attendance. ${statusWord(s.alert)}.`}
          className={`relative w-full overflow-visible rounded-full bg-stone-100 ${emphasis ? "h-3" : "h-2.5"}`}
        >
          {pct !== null && (
            <div className={`absolute inset-y-0 left-0 rounded-full ${barColor[s.alert]}`} style={{ width: pos(pct) }} />
          )}
          <Ticks personal={personal} />
        </div>
        <span className={`w-14 shrink-0 text-right font-semibold tabular-nums ${emphasis ? "text-xl" : ""}`}>{label}</span>
      </div>

      <div>
        <div className="font-medium">{verdict(s)}</div>
        <div className={`text-sm ${textColor[s.alert]}`}>{statusWord(s.alert)}</div>
      </div>
    </div>
  );
}
