"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { classifyAttendanceProvenance, DEFAULT_TARGETS, summarize, type AttendanceProvenance } from "@upes/core";
import { AttendanceRuler, RulerAxis } from "@/components/AttendanceRuler";
import { MockBanner } from "@/components/MockBanner";
import { apiRequest } from "@/lib/api-client";
import { getSupabase } from "@/lib/supabase";
import type { AttendanceView, SubjectView } from "@/lib/attendance-view";

type DashboardData = AttendanceView;

export function DashboardContent({ initialView }: { initialView: AttendanceView }) {
  const [view,setView]=useState<DashboardData>(initialView);
  const [provenance,setProvenance]=useState<AttendanceProvenance>("sample");
  const [profile,setProfile]=useState<{name:string|null;currentSemester:number|null}|null>(null);
  useEffect(()=>{
    let live=true;
    let generation=0;
    let authEventSeen=false;
    const clearAccount=()=>{
      generation++;
      setProfile(null);
      setView(initialView);
      setProvenance("sample");
    };
    const loadAccount=()=>{
      const request=++generation;
      const isCurrent=()=>live&&request===generation;
      apiRequest<{student:{name:string|null;currentSemester:number|null}}>("/v1/me")
        .then(({student})=>{if(isCurrent())setProfile({name:student.name,currentSemester:student.currentSemester})})
        .catch(()=>{if(isCurrent())setProfile(null)});
      apiRequest<{target:number;subjects:{courseCode:string;courseName:string;source:string;counts:{attended:number;conducted:number}}[]}>("/v1/attendance")
        .then(({target,subjects})=>{
          if(!isCurrent())return;
          if(!subjects.length){setView(initialView);setProvenance("sample");return}
          const rows:SubjectView[]=subjects.map(row=>({courseCode:row.courseCode,courseName:row.courseName,source:row.source,...summarize(row.counts,target)}));
          const counts=rows.reduce((total,row)=>({attended:total.attended+row.counts.attended,conducted:total.conducted+row.counts.conducted}),{attended:0,conducted:0});
          const dataProvenance=classifyAttendanceProvenance(subjects.map(subject=>subject.source));
          setView({source:dataProvenance==="sample"?"mock":"account",target,subjects:rows,overall:summarize(counts,target)});
          setProvenance(dataProvenance);
        })
        .catch(()=>{if(isCurrent()){setView(initialView);setProvenance("sample")}});
    };
    const supabase=getSupabase();
    if(!supabase){clearAccount();return()=>{live=false;generation++}}
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      authEventSeen=true;
      if(!session)clearAccount();
      else if(event==="INITIAL_SESSION"||event==="SIGNED_IN"){clearAccount();setTimeout(()=>{if(live)loadAccount()},0);}
    });
    supabase.auth.getSession().then(({data})=>{
      if(!live||authEventSeen)return;
      if(data.session)loadAccount();else clearAccount();
    }).catch(()=>{if(live&&!authEventSeen)clearAccount()});
    return()=>{live=false;generation++;subscription.unsubscribe()};
  },[]);
  const worst=[...view.subjects].filter(s=>s.percentage!==null).sort((a,b)=>a.percentage!-b.percentage!)[0];
  const good=view.subjects.filter(s=>s.percentage!==null&&s.percentage>=view.target).length;
  const overall=view.overall.percentage;
  return <div className="mx-auto max-w-6xl space-y-7 md:space-y-9">
    <section className="hero-grid relative isolate overflow-hidden rounded-[1.6rem] bg-[#111827] px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10 lg:px-12 lg:py-12">
      <div aria-hidden className="absolute -right-16 -top-24 -z-10 h-72 w-72 rotate-45 border border-white/10"/><div aria-hidden className="absolute -right-4 -top-12 -z-10 h-56 w-56 rotate-45 border border-white/10"/>
      <div className="eyebrow text-white/55">UPES · {profile?.name?`Welcome, ${profile.name}`:"Academic overview"}{profile?.currentSemester?` · Semester ${profile.currentSemester}`:""}</div>
      <div className="mt-7 grid gap-8 md:grid-cols-[1fr_auto] md:items-end"><div className="max-w-2xl"><h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl lg:text-6xl">Your semester,<br className="hidden sm:block"/> in clear view.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">{worst&&worst.alert!=="ok"?`${worst.courseName} needs attention first at ${worst.percentage!.toFixed(1)}% attendance.`:"Every subject is at or above your personal attendance target."}</p></div>
        <div className="flex items-end gap-5 sm:gap-8"><div><div className="eyebrow text-white/45">Overall attendance</div><div className="mt-2 text-5xl font-medium tracking-[-0.06em] tabular-nums">{overall===null?"—":`${overall.toFixed(1)}%`}</div></div><div className="mb-1 h-12 w-px bg-white/20"/><div><div className="eyebrow text-white/45">On target</div><div className="mt-2 text-2xl font-medium tabular-nums">{good}<span className="text-white/45">/{view.subjects.length}</span></div></div></div>
      </div><Link href="/attendance" className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-blue-100">Open attendance planner <span aria-hidden>↗</span></Link>
    </section>
    <section aria-label="Semester snapshot" className="grid gap-3 sm:grid-cols-3">
      <div className="student-card p-5"><div className="eyebrow text-muted">Attendance</div><div className="mt-2 text-2xl font-bold tracking-tight">{overall===null?"No data":`${overall.toFixed(1)}%`}</div><p className="mt-1 text-xs text-muted">Personal target: {view.target}%</p></div>
      <div className="student-card p-5"><div className="eyebrow text-muted">Subjects on track</div><div className="mt-2 text-2xl font-bold tracking-tight">{good} <span className="text-base font-medium text-muted">of {view.subjects.length}</span></div><p className="mt-1 text-xs text-muted">At or above your target</p></div>
      <div className="student-card p-5"><div className="eyebrow text-muted">Needs focus</div><div className="mt-2 truncate text-2xl font-bold tracking-tight">{worst?.courseCode??"All good"}</div><p className="mt-1 truncate text-xs text-muted">{worst?worst.courseName:"No subject needs attention"}</p></div>
    </section>
    <section aria-labelledby="quick-actions"><div className="mb-3 flex items-end justify-between"><div><div className="eyebrow text-muted">Shortcuts</div><h2 id="quick-actions" className="mt-1 text-xl font-semibold tracking-tight">What do you want to do?</h2></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Link href="/assignments" className="quick-link"><span><strong className="block text-sm">Add assignment</strong><span className="mt-1 block text-xs text-muted">Plan deadlines & reminders</span></span><span aria-hidden>→</span></Link>
      <Link href="/academics" className="quick-link"><span><strong className="block text-sm">Calculate GPA</strong><span className="mt-1 block text-xs text-muted">Try grade scenarios</span></span><span aria-hidden>→</span></Link>
      <Link href="/calendar" className="quick-link"><span><strong className="block text-sm">Open calendar</strong><span className="mt-1 block text-xs text-muted">See upcoming work</span></span><span aria-hidden>→</span></Link>
      <Link href="/placement" className="quick-link"><span><strong className="block text-sm">Placement check</strong><span className="mt-1 block text-xs text-muted">Review readiness</span></span><span aria-hidden>→</span></Link>
    </div></section>
    {provenance==="mixed"?<div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">This overview combines saved account attendance and sample connector rows. Sample rows are invented development data, not official UPES records.</div>:provenance==="unknown"?<div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">The source of one or more attendance rows could not be confirmed. These rows are not identified as official account data.</div>:provenance==="account"?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Attendance loaded from your account API. Record provenance is retained by the backend.</div>:<MockBanner/>}
    <section aria-labelledby="att" className="surface overflow-hidden rounded-2xl"><div className="flex flex-col gap-3 border-b border-rule px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7"><div><div className="eyebrow text-muted">Your academic pulse</div><h2 id="att" className="mt-1 text-2xl font-semibold tracking-tight">Attendance by subject</h2></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-safe"/>On target</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500"/>Needs attention</span></div></div><div className="px-5 sm:px-7"><RulerAxis personal={view.target}/><AttendanceRuler name="All subjects together" s={view.overall} personal={view.target} emphasis/>{view.subjects.map(s=><AttendanceRuler key={s.courseCode} name={s.courseName} code={s.courseCode} s={s} personal={view.target}/>)}</div><p className="border-t border-rule bg-stone-50 px-5 py-4 text-xs leading-5 text-muted">Markers show {DEFAULT_TARGETS.minimum}% mandatory minimum, {DEFAULT_TARGETS.buffer}% safety buffer, and {view.target}% personal target. Figures are recorded attendance, not predictions.</p></section>
  </div>;
}
