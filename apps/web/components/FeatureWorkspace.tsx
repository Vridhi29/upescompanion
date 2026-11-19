"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { checkPlacement, configuredReminderTimes, gpa, parseReminderOffsets, projectCgpa, requiredAssessmentPercent, retrievePolicyExcerpts, weightedAssessmentPercent, type AssessmentScore, type RetrievedPolicyExcerpt } from "@upes/core";
import { apiRequest, configuredApiUrl } from "@/lib/api-client";
import { getSupabase } from "@/lib/supabase";

type Assignment = { id: string; title: string; course: string; due: string; alarm: string; reminders?: string[]; priority: "Normal" | "High" | "Urgent"; status: "Open" | "In progress" | "Completed" | "Overdue"; source?: string; accountRecord?: boolean };
type Saved = { id: string; title: string; detail: string; status: string; createdAt: string; accountRecord?: boolean; extra?: Record<string, string | number | boolean> };
type Profile = {email:string;name:string|null;universityId:string|null;department:string|null;degree:string|null;specialization:string|null;batch:string|null;currentSemester:number|null;academicYear:string|null};
const EMPTY_PROFILE:Profile={email:"",name:"",universityId:"",department:"",degree:"",specialization:"",batch:"",currentSemester:null,academicYear:""};
function writeLocalStorage(key:string,value:string){try{localStorage.setItem(key,value);return true}catch{return false}}
function readStoredArray<T>(key:string,isItem:(value:unknown)=>value is T):T[]{try{const value:unknown=JSON.parse(localStorage.getItem(key)??"[]");return Array.isArray(value)?value.filter(isItem):[]}catch{return[]}}
function isSaved(value:unknown):value is Saved{if(!value||typeof value!=="object")return false;const item=value as Partial<Saved>;return typeof item.id==="string"&&typeof item.title==="string"&&typeof item.detail==="string"&&typeof item.status==="string"&&typeof item.createdAt==="string"&&(item.accountRecord===undefined||typeof item.accountRecord==="boolean")}
function isAssignment(value:unknown):value is Assignment{if(!value||typeof value!=="object")return false;const item=value as Partial<Assignment>;return typeof item.id==="string"&&typeof item.title==="string"&&typeof item.course==="string"&&typeof item.due==="string"&&typeof item.alarm==="string"&&["Normal","High","Urgent"].includes(item.priority??"")&&["Open","In progress","Completed","Overdue"].includes(item.status??"")&&(item.reminders===undefined||(Array.isArray(item.reminders)&&item.reminders.every(time=>typeof time==="string")))&&(item.source===undefined||typeof item.source==="string")&&(item.accountRecord===undefined||typeof item.accountRecord==="boolean")}
const removedAssignmentKeys=new Set<string>();
function readAssignments(key:string):Assignment[]{return readStoredArray(key,isAssignment).filter(item=>!removedAssignmentKeys.has(`${key}:${item.id}`)).map(item=>({...item,source:item.source??"manual",accountRecord:item.accountRecord??false}))}
function isAssessmentList(value:unknown):value is AssessmentScore[]{return Array.isArray(value)&&value.every(item=>!!item&&typeof item==="object"&&typeof item.name==="string"&&Number.isFinite(item.obtained)&&Number.isFinite(item.maximum)&&Number.isFinite(item.weight))}
function isCourseList(value:unknown):value is {course:string;credits:number;gradePoints:number}[]{return Array.isArray(value)&&value.every(item=>!!item&&typeof item==="object"&&typeof item.course==="string"&&Number.isFinite(item.credits)&&Number.isFinite(item.gradePoints))}
function useStorageKey(key: string) {
  const [scope, setScope] = useState("device");
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let live = true;
    let authEventSeen = false;
    supabase.auth.getSession().then(({ data }) => { if (live && !authEventSeen) setScope(data.session?.user.id ?? "device"); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventSeen = true;
      setScope(session?.user.id ?? "device");
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return `upes:${scope}:${key}`;
}
function useSaved(key: string) {
  const storageKey = useStorageKey(key);
  const [items, setItems] = useState<Saved[]>([]);
  const [ready, setReady] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [storageWarning,setStorageWarning]=useState("");
  useEffect(() => { setReady(false);setStorageWarning(""); setItems(readStoredArray(storageKey,isSaved)); setLoadedKey(storageKey); setReady(true); }, [storageKey]);
  useEffect(() => { if (ready && loadedKey === storageKey) setStorageWarning(writeLocalStorage(storageKey, JSON.stringify(items))?"":"Browser storage is blocked; local-only changes may be lost when this page closes."); }, [items, storageKey, ready, loadedKey]);
  const scopeReady=ready&&loadedKey===storageKey;
  const scopeRef=useRef(storageKey);
  useEffect(()=>{scopeRef.current=storageKey},[storageKey]);
  const setScopedItems:typeof setItems=(next)=>{if(scopeReady&&scopeRef.current===storageKey)setItems(next)};
  return { items:scopeReady?items:[], setItems:setScopedItems, ready:scopeReady, storageKey, storageWarning };
}
function useLocalValue<T>(key: string, initial: T, isValue:(value:unknown)=>value is T) {
  const storageKey = useStorageKey(key);
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [storageWarning,setStorageWarning]=useState("");
  useEffect(() => { setReady(false);setStorageWarning(""); try { const stored = localStorage.getItem(storageKey); if (stored !== null) {const parsed:unknown=JSON.parse(stored);setValue(isValue(parsed)?parsed:initial)} else setValue(initial); } catch { setValue(initial); } setLoadedKey(storageKey); setReady(true); }, [storageKey]);
  useEffect(() => { if (ready && loadedKey === storageKey) setStorageWarning(writeLocalStorage(storageKey, JSON.stringify(value))?"":"Browser storage is blocked; local-only changes may be lost when this page closes."); }, [storageKey, value, ready, loadedKey]);
  const scopeReady=ready&&loadedKey===storageKey;
  const scopeRef=useRef(storageKey);
  useEffect(()=>{scopeRef.current=storageKey},[storageKey]);
  const setScopedValue:typeof setValue=(next)=>{if(scopeReady&&scopeRef.current===storageKey)setValue(next)};
  return { value:scopeReady?value:initial, setValue:setScopedValue, ready:scopeReady, storageKey, storageWarning };
}

const labels: Record<string, { title: string; kicker: string; intro: string }> = {
  academics: { title: "Academic performance", kicker: "Grades & projections", intro: "Record your internal marks and explore grade and GPA scenarios using the weights, credits, and grade points you provide." },
  assignments: { title: "Assignments", kicker: "Plan the work", intro: "Keep manually entered coursework, due dates, and reminders together." },
  calendar: { title: "Calendar", kicker: "Your month at a glance", intro: "A lightweight calendar built from the assignments and deadlines you add." },
  policy: { title: "Academic Policy AI", kicker: "Grounded policy assistant", intro: "Ask a question against cited policy passages. Generated answers are available only when the API has a model configured." },
  "directed-reading": { title: "Directed Reading", kicker: "Progress tracker", intro: "Track an application and its milestones using the status shared with you by your faculty guide." },
  backlogs: { title: "Backlogs", kicker: "Clearance planner", intro: "Track pending courses and plan your next attempt. Eligibility remains subject to official UPES rules." },
  placement: { title: "Placement readiness", kicker: "Eligibility analyzer", intro: "Compare your self-reported record against thresholds you enter from an official placement notice." },
  notifications: { title: "Notifications", kicker: "Reminder preferences", intro: "Choose how reminders behave on this device. Browser notifications require permission and the portal to remain open." },
  settings: { title: "Settings", kicker: "Student profile", intro: "Keep your academic profile current. Profile changes save to the authenticated backend when the API is available." },
};

function Heading({ section }: { section: string }) {
  const data = labels[section] ?? labels.assignments!;
  return <header className="mb-7"><div className="eyebrow text-muted">{data.kicker}</div><h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{data.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">{data.intro}</p></header>;
}
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`surface rounded-2xl p-5 sm:p-7 ${className}`}>{children}</section>; }
function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block text-sm font-medium">{label}<input {...props} className={`mt-2 w-full rounded-xl border border-rule bg-white px-3.5 py-2.5 shadow-sm shadow-black/[.02] ${props.className ?? ""}`} /></label>; }
function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) { return <label className="block text-sm font-medium">{label}<select {...props} className="mt-2 w-full rounded-xl border border-rule bg-white px-3.5 py-2.5">{children}</select></label>; }
function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className={`rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 ${props.className ?? ""}`}>{children}</button>; }
function LocalNote({ children = "Saved in this browser on this device. Sign-in and backend sync are not connected for this module yet." }: { children?: ReactNode }) { return <p className="mt-4 text-xs leading-5 text-muted">{children}</p>; }

function AcademicPage() {
  const [name, setName] = useState(""); const [obtained, setObtained] = useState(""); const [maximum, setMaximum] = useState(""); const [weight, setWeight] = useState("");
  const { value: scores, setValue: setScores, ready: scoresReady, storageKey:scoresStorageKey, storageWarning:scoresStorageWarning } = useLocalValue<AssessmentScore[]>("assessment-scores", [], isAssessmentList); const [target, setTarget] = useState("75"); const [remaining, setRemaining] = useState("40"); const [courseTitle, setCourseTitle] = useState(""); const [credits, setCredits] = useState(""); const [points, setPoints] = useState(""); const { value: courses, setValue: setCourses, ready: coursesReady, storageKey:coursesStorageKey, storageWarning:coursesStorageWarning } = useLocalValue<{course:string;credits:number;gradePoints:number}[]>("term-grades", [], isCourseList); const [error, setError] = useState("");
  useEffect(()=>{setName("");setObtained("");setMaximum("");setWeight("");setTarget("75");setRemaining("40");setCourseTitle("");setCredits("");setPoints("");setError("");setSemester("");setSelectedSemester("");setRecordMessage("")},[scoresStorageKey,coursesStorageKey]);
  const accountScope=useStorageKey("academic-records");const accountScopeRef=useRef(accountScope);useEffect(()=>{accountScopeRef.current=accountScope},[accountScope]);
  const [semester, setSemester] = useState(""); const [selectedSemester, setSelectedSemester] = useState(""); const [savedSemesters, setSavedSemesters] = useState<number[]>([]); const [recordScope,setRecordScope]=useState(""); const [recordMessage, setRecordMessage] = useState(""); const [savingRecord, setSavingRecord] = useState(false);
  useEffect(() => {let live=true;setRecordScope("");setSavedSemesters([]);setSelectedSemester("");apiRequest<{ records: { semester: number }[] }>("/v1/academics/records").then(({ records }) => {if(live){setSavedSemesters(records.map((record) => record.semester));setRecordScope(accountScope)}}).catch(() => {if(live)setRecordScope(accountScope)});return()=>{live=false}}, [accountScope]);
  const accountRecordsReady=recordScope===accountScope&&scoresReady&&coursesReady;
  const current = useMemo(() => { try { return weightedAssessmentPercent(scores); } catch { return null; } }, [scores]);
  const gpaValue = useMemo(() => { try { return gpa(courses); } catch { return null; } }, [courses]);
  function addScore(e: FormEvent) { e.preventDefault();if(!scoresReady)return; try { const item = { name, obtained: Number(obtained), maximum: Number(maximum), weight: Number(weight) }; weightedAssessmentPercent([...scores, item]); setScores([...scores, item]); setName(""); setObtained(""); setMaximum(""); setWeight(""); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Check the assessment values."); } }
  function addCourse(e: FormEvent) { e.preventDefault();if(!coursesReady)return; const item = { course: courseTitle, credits: Number(credits), gradePoints: Number(points) }; try { const updated = [...courses, item]; const value = gpa(updated); if (value === null) return; setCourses(updated); setCourseTitle(""); setCredits(""); setPoints(""); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Check credits and grade points."); } }
  async function loadRecord() { const term = Number(selectedSemester); if (!term||!accountRecordsReady) return;const requestScope=accountScope; try { const { records } = await apiRequest<{ records: { semester: number; payload: { assessments: AssessmentScore[]; courses: { course: string; credits: number; gradePoints: number }[] } }[] }>("/v1/academics/records");if(accountScopeRef.current!==requestScope)return; const record = records.find((item) => item.semester === term); if (!record) { setRecordMessage("No saved record for that semester."); return; } setSemester(String(term)); setScores(record.payload.assessments); setCourses(record.payload.courses); setRecordMessage(`Loaded semester ${term} from your account.`); } catch (e) { if(accountScopeRef.current===requestScope)setRecordMessage(e instanceof Error ? e.message : "Could not load your account record."); } }
  async function saveRecord() {if(!accountRecordsReady)return;const requestScope=accountScope; const term = Number(semester); if (!Number.isInteger(term) || term < 1 || term > 16) { setRecordMessage("Enter a semester from 1 to 16."); return; } setSavingRecord(true); try { const result = await apiRequest<{ record: { semester: number } }>("/v1/academics/records", { method: "PUT", body: JSON.stringify({ semester: term, assessments: scores, courses }) });if(accountScopeRef.current!==requestScope)return; setSavedSemesters((current) => [...new Set([...current, result.record.semester])].sort((a, b) => a - b)); setRecordMessage(`Semester ${term} saved to your account transcript.`); } catch (e) { if(accountScopeRef.current===requestScope)setRecordMessage(e instanceof Error ? `${e.message} Your calculator entries remain saved in this browser.` : "Account save unavailable. Calculator entries remain saved in this browser."); } finally { setSavingRecord(false); } }
  const needed = useMemo(() => { if (current === null) return null; try { return requiredAssessmentPercent(current, scores.reduce((s, x) => s + x.weight, 0), Number(remaining), Number(target)); } catch { return null; } }, [current, scores, remaining, target]);
  return <div className="grid gap-5 lg:grid-cols-2">
    <Panel className="lg:col-span-2"><div className="eyebrow text-muted">Academic record</div><h2 className="mt-1 text-xl font-semibold">Save or load a semester</h2><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"><Field label="Semester number" type="number" min="1" max="16" value={semester} onChange={(event) => setSemester(event.target.value)}/><SelectField label="Saved semesters" value={selectedSemester} onChange={(event) => setSelectedSemester(event.target.value)}><option value="">Choose a saved record</option>{(recordScope===accountScope?savedSemesters:[]).map((term) => <option key={term} value={term}>{`Semester ${term}`}</option>)}</SelectField><button disabled={!accountRecordsReady} onClick={() => void loadRecord()} className="rounded-xl border border-rule px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Load</button><Button disabled={savingRecord||!accountRecordsReady} onClick={() => void saveRecord()}>{savingRecord ? "Saving…" : "Save record"}</Button></div>{recordMessage && <p role="status" className="mt-3 text-sm text-muted">{recordMessage}</p>}<p className="mt-2 text-xs text-muted">Academic entries save to the existing per-student transcript payload when the API is available. These are manual records, not imported UPES results.</p></Panel>
    <Panel><div className="eyebrow text-muted">Internal assessments</div><h2 className="mt-1 text-xl font-semibold">Marks & target calculator</h2><p className="mt-2 text-sm text-muted">Weights are normalized from your entries. The portal does not assume a UPES grading scheme.</p>
      <form onSubmit={addScore} className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Assessment" maxLength={160} value={name} onChange={e=>setName(e.target.value)} required placeholder="Midterm"/><Field label="Marks earned" type="number" min="0" step="any" value={obtained} onChange={e=>setObtained(e.target.value)} required/><Field label="Maximum marks" type="number" min="0.01" step="any" value={maximum} onChange={e=>setMaximum(e.target.value)} required/><Field label="Weight (%)" type="number" min="0" max="100" step="any" value={weight} onChange={e=>setWeight(e.target.value)} required/><Button disabled={!scoresReady} className="sm:col-span-2">Add assessment</Button></form>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 space-y-2">{scores.map((s,i)=><div key={`${s.name}-${i}`} className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3 text-sm"><span>{s.name} <small className="text-muted">· {s.weight}%</small></span><span className="flex items-center gap-3"><strong>{s.obtained}/{s.maximum}</strong><button aria-label={`Remove ${s.name}`} onClick={()=>setScores(scores.filter((_,index)=>index!==i))} className="text-muted hover:text-danger">×</button></span></div>)}</div>
      <div className="mt-5 rounded-xl bg-black p-4 text-white"><div className="eyebrow text-white/50">Weighted result</div><div className="mt-1 text-3xl font-semibold tabular-nums">{current === null ? "—" : `${current.toFixed(1)}%`}</div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Target overall (%)" type="number" min="0" max="100" value={target} onChange={e=>setTarget(e.target.value)}/><Field label="Remaining weight (%)" type="number" min="0" value={remaining} onChange={e=>setRemaining(e.target.value)}/></div>
      <p className="mt-3 text-sm text-muted">Required score across remaining assessments: <strong className="text-ink">{needed === null ? "add completed marks" : needed < 0 ? "target already met" : needed > 100 ? "target is not reachable" : `${needed.toFixed(1)}%`}</strong></p><LocalNote>{scoresStorageWarning||"Assessment entries are saved in this browser; semester snapshots can also be saved to the account transcript."}</LocalNote>
    </Panel>
    <Panel><div className="eyebrow text-muted">SGPA / CGPA scenarios</div><h2 className="mt-1 text-xl font-semibold">Credit weighted projection</h2><p className="mt-2 text-sm text-muted">Enter grade points based on your transcript or a verified grading policy.</p>
      <form onSubmit={addCourse} className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Course" maxLength={160} value={courseTitle} onChange={e=>setCourseTitle(e.target.value)} required/><Field label="Course credits" type="number" min="0.01" step="any" value={credits} onChange={e=>setCredits(e.target.value)} required/><Field label="Grade points" type="number" min="0" step="any" value={points} onChange={e=>setPoints(e.target.value)} required/><Button disabled={!coursesReady} className="sm:col-span-2">Add course result</Button></form>
      <div className="mt-5 rounded-xl bg-emerald-50 p-4"><div className="eyebrow text-emerald-800">Term GPA · entered courses</div><div className="mt-1 text-3xl font-semibold text-emerald-800">{gpaValue?.toFixed(2) ?? "—"}</div></div>
      <div className="mt-3 space-y-2">{courses.map((c,i)=><div key={`${c.course}-${i}`} className="flex justify-between rounded-xl bg-stone-50 px-4 py-3 text-sm"><span>{c.course}<small className="ml-2 text-muted">{c.credits} credits</small></span><span>{c.gradePoints}<button aria-label={`Remove ${c.course}`} onClick={()=>setCourses(courses.filter((_,index)=>index!==i))} className="ml-3 text-muted hover:text-danger">×</button></span></div>)}</div>
      <CgpaProjection/>
      <p className="mt-4 text-xs leading-5 text-muted">Grade boundaries and conversions are not inferred. Use official transcript values for reliable projections.</p><LocalNote>{coursesStorageWarning||"Course results are saved in this browser; semester snapshots can also be saved to the account transcript."}</LocalNote>
    </Panel>
  </div>;
}
function CgpaProjection() { const [doneCredits,setDoneCredits]=useState(""); const [donePoints,setDonePoints]=useState(""); const [nextCredits,setNextCredits]=useState(""); const [nextPoints,setNextPoints]=useState(""); const val=useMemo(()=>{if([doneCredits,donePoints,nextCredits,nextPoints].some(x=>x.trim()===""))return null;const nums=[doneCredits,donePoints,nextCredits,nextPoints].map(Number); if(nums.some(Number.isNaN))return null; try{return projectCgpa({credits:nums[0]!,points:nums[1]!},{credits:nums[2]!,points:nums[3]!});}catch{return null;}},[doneCredits,donePoints,nextCredits,nextPoints]); return <div className="mt-5"><div className="eyebrow text-muted">CGPA projection · credits & quality points</div><div className="mt-3 grid grid-cols-2 gap-3"><Field label="Completed credits" type="number" min="0" step="any" value={doneCredits} onChange={e=>setDoneCredits(e.target.value)}/><Field label="Completed quality points" type="number" min="0" step="any" value={donePoints} onChange={e=>setDonePoints(e.target.value)}/><Field label="Planned credits" type="number" min="0" step="any" value={nextCredits} onChange={e=>setNextCredits(e.target.value)}/><Field label="Planned quality points" type="number" min="0" step="any" value={nextPoints} onChange={e=>setNextPoints(e.target.value)}/></div><p className="mt-3 text-sm">Projected cumulative GPA: <strong>{val === null ? "—" : val.toFixed(2)}</strong></p></div>; }

function AssignmentsPage() {
  const storageKey=useStorageKey("assignments");const settingsKey=useStorageKey("notification-settings");const scopeRef=useRef(storageKey);useEffect(()=>{scopeRef.current=storageKey},[storageKey]);
  const [items,setItems]=useState<Assignment[]>([]);const itemsRef=useRef(items);const commitItems=(next:Assignment[])=>{itemsRef.current=next;setItems(next)};const [ready,setReady]=useState(false);const [loadedKey,setLoadedKey]=useState("");const [title,setTitle]=useState("");const [course,setCourse]=useState("");const [due,setDue]=useState("");const [alarm,setAlarm]=useState("");const [priority,setPriority]=useState<Assignment["priority"]>("Normal"); const [permission,setPermission]=useState("default");const [persistence,setPersistence]=useState("Loading assignments…");const scopeReady=ready&&loadedKey===storageKey;const visibleItems=scopeReady?items:[];
  useEffect(()=>{setTitle("");setCourse("");setDue("");setAlarm("");setPriority("Normal")},[storageKey]);
  useEffect(()=>{let live=true;const onLocalUpdate=(event:Event)=>{const ids=(event as CustomEvent<{removedIds?:unknown}>).detail?.removedIds;if(Array.isArray(ids))for(const id of ids)if(typeof id==="string")removedAssignmentKeys.add(`${storageKey}:${id}`);if(live)commitItems(readAssignments(storageKey))};window.addEventListener("upes:assignments-updated",onLocalUpdate);setReady(false);setLoadedKey("");const cached=readAssignments(storageKey);if("Notification" in window)setPermission(Notification.permission);apiRequest<{assignments:{id:string;title:string;courseCode:string|null;description:string|null;dueAt:string|null;status:string;source:string}[] }>("/v1/assignments").then(({assignments})=>{if(!live)return;const meta=new Map(cached.map(x=>[x.id,x]));const remote:Assignment[]=assignments.map(x=>{const prior=meta.get(x.id);return{id:x.id,title:x.title,course:x.courseCode??"",due:x.dueAt??"",alarm:prior?.alarm??"",reminders:prior?.reminders??[],priority:prior?.priority??"Normal",status:assignmentUiStatus(x.status),source:x.source,accountRecord:true}});commitItems([...remote,...cached.filter(local=>!local.accountRecord&&!remote.some(row=>row.id===local.id))]);setPersistence("Assignments load from your account database; reminder times are saved on this device.");setLoadedKey(storageKey);setReady(true)}).catch(()=>{if(!live)return;commitItems(cached);setPersistence("Saved in this browser on this device. Sign in and configure the API to sync assignments.");setLoadedKey(storageKey);setReady(true)});return()=>{live=false;window.removeEventListener("upes:assignments-updated",onLocalUpdate)}},[storageKey]);
  useEffect(()=>{if(ready&&loadedKey===storageKey&&!writeLocalStorage(storageKey,JSON.stringify(items)))setPersistence("Browser storage is blocked. Account assignments remain saved, but device reminders cannot persist on this device.")},[items,ready,loadedKey,storageKey]);
  useEffect(()=>{
    let live=true;
    apiRequest<{preferences:{quietStart:string|null;quietEnd:string|null;reminderOffsetsMinutes:number[];channels:string[]}|null}>("/v1/notification-preferences")
      .then(({preferences})=>{
        if(!live||!preferences)return;
        let current:Record<string,unknown>={};
        try{current=JSON.parse(localStorage.getItem(settingsKey)??"{}") as Record<string,unknown>}catch{}
        writeLocalStorage(settingsKey,JSON.stringify({...current,browser:(preferences.channels.includes("local")||preferences.channels.includes("web_push")),quietStart:preferences.quietStart??"",quietEnd:preferences.quietEnd??"",offsets:preferences.reminderOffsetsMinutes.join(",")}));
      }).catch(()=>undefined);
    return()=>{live=false};
  },[settingsKey]);
   async function add(e:FormEvent){
    e.preventDefault();
    if(!scopeReady)return;
    const normalizedTitle=title.trim();const normalizedCourse=course.trim();
    if(!normalizedTitle){setPersistence("Enter an assignment title.");return}
    const dueAt=due?new Date(due).toISOString():null;
    let alarmAt=alarm;
    let reminders:string[]=[];
    let offsetWarning="";
    if(!alarmAt&&dueAt){
      let offsets=[1440,180,60];
      try{
        const preferences=JSON.parse(localStorage.getItem(settingsKey)??"{}") as {offsets?:string};
        if(preferences.offsets!==undefined)offsets=parseReminderOffsets(preferences.offsets);
      }catch{
        offsetWarning="Automatic reminder skipped because reminder offsets are invalid. Review them in Notifications.";
      }
      if(!offsetWarning){reminders=configuredReminderTimes(dueAt,offsets);if(reminders[0])alarmAt=localDateTime(new Date(reminders[0]))}
    }
    const item:Assignment={id:crypto.randomUUID(),title:normalizedTitle,course:normalizedCourse,due,alarm:alarmAt,reminders,priority,status:"Open",source:"manual",accountRecord:false};
    let persistenceMessage="";
    try{
      const result=await apiRequest<{assignment:{id:string;title:string;courseCode:string|null;dueAt:string|null;source:string}}>("/v1/assignments",{method:"POST",body:JSON.stringify({title:normalizedTitle,courseCode:normalizedCourse||null,dueAt,status:"new"})});
      item.id=result.assignment.id;item.due=result.assignment.dueAt??"";item.source=result.assignment.source;item.accountRecord=true;
      persistenceMessage=alarmAt?"Assignment saved to your account; its reminder sequence is set on this device.":"Assignment saved to your account database; no future offset reminder applies.";
    }catch{
      persistenceMessage=alarmAt?"Assignment saved in this browser with device reminders.":"Assignment saved in this browser. Sign in and configure the API to sync it.";
    }
    if(scopeRef.current!==storageKey)return;
    const next=[item,...itemsRef.current];
    const localSaved=writeLocalStorage(storageKey,JSON.stringify(next));
    if(!localSaved)persistenceMessage=persistenceMessage.startsWith("Assignment saved to your account")?`${persistenceMessage} Browser storage is blocked, so its device reminder cannot persist.`:"Assignment is only in memory; browser storage is blocked and the API is unavailable.";
    setPersistence([persistenceMessage,offsetWarning].filter(Boolean).join(" "));
    commitItems(next);setTitle("");setCourse("");setDue("");setAlarm("");
  }
  async function ask(){
    if(!("Notification" in window)){setPersistence("Browser notifications are not supported here; in-app reminders still work while the portal is open.");return}
    try{
      const result=await Notification.requestPermission();
      setPermission(result);
      setPersistence(result==="granted"?"Browser notifications are enabled on this device.":"Browser permission was not granted; in-app reminders still work while the portal is open.");
    }catch{setPersistence("Browser notification permission could not be checked; in-app reminders still work while the portal is open.")}
  }
  async function update(id:string,status:Assignment["status"]){if(!scopeReady)return;const requestScope=storageKey;const item=itemsRef.current.find(x=>x.id===id);commitItems(itemsRef.current.map(x=>x.id===id?{...x,status}:x));if(!item?.accountRecord){setPersistence("Status saved on this device; this assignment is not in your account database.");return}try{const apiStatus=status==="Completed"?"completed":status==="In progress"?"in_progress":status==="Overdue"?"overdue":"new";await apiRequest(`/v1/assignments/${id}`,{method:"PATCH",body:JSON.stringify({status:apiStatus})});if(scopeRef.current===requestScope)setPersistence("Assignment status saved to your account database; reminders stay on this device.")}catch{if(scopeRef.current===requestScope)setPersistence("Status updated in this browser. Account sync is unavailable for this item.")}}
  async function remove(item:Assignment){if(!scopeReady||item.source!=="manual")return;if(!window.confirm("Remove this manual assignment and its device reminder schedule?"))return;const requestScope=storageKey;if(item.accountRecord){try{await apiRequest(`/v1/assignments/${item.id}`,{method:"DELETE"})}catch(error){if(scopeRef.current===requestScope)setPersistence(error instanceof Error?`Could not remove the account assignment: ${error.message}`:"Could not remove the account assignment.");return}}if(scopeRef.current!==requestScope)return;const next=itemsRef.current.filter(row=>row.id!==item.id);const saved=writeLocalStorage(storageKey,JSON.stringify(next));commitItems(next);window.dispatchEvent(new CustomEvent("upes:assignments-updated",{detail:{removedIds:[item.id]}}));setPersistence(saved?item.accountRecord?"Manual assignment removed from your account; its device reminder schedule was removed.":"Assignment removed from this device.":"Removed for this session only; browser storage is blocked.")}
  return <><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Panel><div className="eyebrow text-muted">New task</div><h2 className="mt-1 text-xl font-semibold">Add assignment</h2><form onSubmit={add} className="mt-5 space-y-4"><Field label="Assignment title" maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} required/><Field label="Course / subject" maxLength={80} value={course} onChange={e=>setCourse(e.target.value)}/><Field label="Due date and time" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/><Field label="Reminder alarm (optional; auto uses next offset)" type="datetime-local" value={alarm} onChange={e=>setAlarm(e.target.value)}/><SelectField label="Priority" value={priority} onChange={e=>setPriority(e.target.value as Assignment["priority"])}><option>Normal</option><option>High</option><option>Urgent</option></SelectField><Button className="w-full" disabled={!scopeReady}>Save assignment</Button></form><Button onClick={ask} className="mt-3 w-full bg-black hover:bg-stone-800">Enable browser reminders · {permission}</Button><p className="mt-3 text-xs leading-5 text-muted">Alarms run while this portal is open on this device. Browser settings may also need to allow notifications.</p><LocalNote>{persistence}</LocalNote></Panel>
    <Panel><div className="eyebrow text-muted">Task queue</div><h2 className="mt-1 text-xl font-semibold">Upcoming work <span className="text-muted">· {visibleItems.filter(x=>x.status!=="Completed").length}</span></h2><div className="mt-5 space-y-3">{visibleItems.length===0?<div className="rounded-xl bg-stone-50 px-4 py-8 text-center text-sm text-muted">{scopeReady?"No assignments yet. Add your own coursework to get started.":"Loading assignments…"}</div>:visibleItems.map(x=><article key={x.id} className="rounded-2xl border border-rule p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 break-words font-semibold">{x.title}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${x.priority==="Urgent"?"bg-red-100 text-red-700":x.priority==="High"?"bg-blue-100 text-blue-700":"bg-stone-100 text-muted"}`}>{x.priority}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${x.accountRecord?"bg-stone-100 text-muted":"bg-amber-50 text-amber-800"}`}>{x.accountRecord?"Account":"Device only"}</span></div><p className="mt-1 text-sm text-muted">{x.course||"No course specified"} {x.due?`· Due ${new Date(x.due).toLocaleString()}`:"· No due date"}</p>{x.alarm&&<p className="mt-1 text-xs text-blue-700">◷ Reminder {new Date(x.alarm).toLocaleString()}</p>}</div><div className="flex flex-wrap items-end gap-2"><SelectField label="Status" disabled={!scopeReady} value={x.status} onChange={e=>update(x.id,e.target.value as Assignment["status"])}><option>Open</option><option>In progress</option><option>Completed</option><option>Overdue</option></SelectField>{x.source==="manual"&&<button type="button" disabled={!scopeReady} onClick={()=>void remove(x)} aria-label={`Remove ${x.title}`} className="mb-0.5 rounded-xl border border-rule px-3 py-2.5 text-sm font-semibold text-muted hover:border-red-200 hover:text-red-700 disabled:opacity-50">Remove</button>}</div></div></article>)}</div><LocalNote>{persistence}</LocalNote></Panel></div></>;
}

function CalendarPage(){
  const storageKey=useStorageKey("assignments");
  const [items,setItems]=useState<Assignment[]>([]);
  const [loadedKey,setLoadedKey]=useState("");
  const [persistence,setPersistence]=useState("Loading assignment calendar…");
  const [month,setMonth]=useState(()=>new Date());
  const [selected,setSelected]=useState(()=>dateKey(new Date()));
  useEffect(()=>{
    let live=true;
    setLoadedKey("");
    let cached:Assignment[]=[];
    cached=readAssignments(storageKey);
    apiRequest<{assignments:{id:string;title:string;courseCode:string|null;dueAt:string|null;status:string;source:string}[]}>("/v1/assignments")
      .then(({assignments})=>{
        if(!live)return;
        const meta=new Map(cached.map(item=>[item.id,item]));
        const remote:Assignment[]=assignments.map(item=>{
          const local=meta.get(item.id);
          return {id:item.id,title:item.title,course:item.courseCode??"",due:item.dueAt??"",alarm:local?.alarm??"",reminders:local?.reminders??[],priority:local?.priority??"Normal",status:assignmentUiStatus(item.status),source:item.source,accountRecord:true};
        });
        setItems([...remote,...cached.filter(local=>!local.accountRecord&&!remote.some(item=>item.id===local.id))]);
        setPersistence("Deadlines load from your account assignments; alarm times remain on this device.");
        setLoadedKey(storageKey);
      })
      .catch(()=>{
        if(!live)return;
        setItems(cached);
        setPersistence("Showing assignments saved in this browser. Account calendar sync is unavailable.");
        setLoadedKey(storageKey);
      });
    return()=>{live=false};
  },[storageKey]);
  useEffect(()=>{if(loadedKey===storageKey&&!writeLocalStorage(storageKey,JSON.stringify(items)))setPersistence("Browser storage is blocked; account deadlines still load, but device-only assignment metadata cannot persist.")},[items,loadedKey,storageKey]);
  const scopeReady=loadedKey===storageKey;const visibleItems=scopeReady?items:[];
  const year=month.getFullYear();const m=month.getMonth();const start=new Date(year,m,1);const offset=(start.getDay()+6)%7;const count=new Date(year,m+1,0).getDate();const cells=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{const n=i-offset+1;return n<1||n>count?null:n});const dated=visibleItems.filter(x=>x.due&&dateKey(new Date(x.due))===selected);const changeMonth=(delta:number)=>{const next=new Date(year,m+delta,1);setMonth(next);setSelected(dateKey(next))};
  return <Panel><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="eyebrow text-muted">Assignment calendar</div><h2 className="mt-1 text-2xl font-semibold">{month.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2></div><div className="flex gap-2"><button aria-label="Previous month" className="h-10 w-10 rounded-full border border-rule" onClick={()=>changeMonth(-1)}>‹</button><button aria-label="Next month" className="h-10 w-10 rounded-full border border-rule" onClick={()=>changeMonth(1)}>›</button></div></div><div className="mt-6 grid grid-cols-7 gap-1 text-center sm:gap-2">{["M","T","W","T","F","S","S"].map((d,i)=><div key={`${d}${i}`} className="py-2 text-xs font-semibold text-muted">{d}</div>)}{cells.map((day,i)=>{const key=day?dateKey(new Date(year,m,day)):"";const has=visibleItems.some(x=>x.due&&dateKey(new Date(x.due))===key&&x.status!=="Completed");return <button key={i} disabled={!day} onClick={()=>day&&setSelected(key)} aria-label={day?`${new Date(year,m,day).toLocaleDateString()}${has?", assignment due":""}`:undefined} aria-pressed={day?key===selected:undefined} className={`relative mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full text-sm transition ${!day?"":"hover:bg-stone-100"} ${key===selected?"bg-blue-600 font-semibold text-white hover:bg-blue-700":""}`}>{day}{has&&<span className={`absolute bottom-1 h-1 w-1 rounded-full ${key===selected?"bg-white":"bg-emerald-600"}`}/>}</button>})}</div><div className="mt-7 border-t border-rule pt-5"><div className="eyebrow text-muted">Selected day</div><h3 className="mt-1 font-semibold">{new Date(`${selected}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h3><div className="mt-3 space-y-2">{dated.length===0?<p className="text-sm text-muted">{scopeReady?"No assignment deadlines saved for this date.":"Loading assignment deadlines…"}</p>:dated.map(x=><div key={x.id} className="flex justify-between gap-4 rounded-xl bg-stone-50 px-4 py-3 text-sm"><span className="min-w-0 break-words">{x.title}<small className="ml-2 text-muted">{x.course}</small><small className={`ml-2 font-semibold ${x.accountRecord?"text-muted":"text-amber-800"}`}>{x.accountRecord?"Account":"Device only"}</small></span><span className={x.status==="Completed"?"text-emerald-700":"text-blue-700"}>{x.status}</span></div>)}</div></div><p className="mt-4 text-xs text-muted"><span className="text-emerald-600">●</span> Upcoming assignment · Calendar includes account deadlines and device-only assignments.</p><LocalNote>{persistence}</LocalNote></Panel>
}
function dateKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function localDateTime(d:Date){const local=new Date(d.getTime()-d.getTimezoneOffset()*60_000);return local.toISOString().slice(0,16)}
function isQuietHours(start?:string,end?:string){if(!start||!end||start===end)return false;const [sh,sm]=start.split(":").map(Number);const [eh,em]=end.split(":").map(Number);const now=new Date();const current=now.getHours()*60+now.getMinutes();const from=(sh??0)*60+(sm??0);const to=(eh??0)*60+(em??0);return from<to?current>=from&&current<to:current>=from||current<to}

function PolicyPage(){
  const {items,setItems,ready,storageKey:policyStorageKey,storageWarning}=useSaved("policy-sources");
  const searchScope=useStorageKey("policy-search");const searchScopeRef=useRef(searchScope);useEffect(()=>{searchScopeRef.current=searchScope},[searchScope]);
  const [title,setTitle]=useState("");const [version,setVersion]=useState("");const [url,setUrl]=useState("");const [text,setText]=useState("");
  const [query,setQuery]=useState("");const [includeLocal,setIncludeLocal]=useState(false);const [hits,setHits]=useState<RetrievedPolicyExcerpt[]>([]);const [answerSources,setAnswerSources]=useState<RetrievedPolicyExcerpt[]>([]);const [answer,setAnswer]=useState("");const [searched,setSearched]=useState(false);const [searchMessage,setSearchMessage]=useState("");const [searching,setSearching]=useState(false);
  const [hitsScope,setHitsScope]=useState("");const visibleHits=hitsScope===searchScope?hits:[];
  useEffect(()=>{setTitle("");setVersion("");setUrl("");setText("");setQuery("")},[policyStorageKey]);
  useEffect(()=>{setHits([]);setAnswerSources([]);setAnswer("");setIncludeLocal(false);setHitsScope("");setSearched(false);setSearching(false);setSearchMessage("")},[searchScope]);
  function add(e:FormEvent){e.preventDefault();if(!ready)return;setItems([{id:crypto.randomUUID(),title:title.trim(),detail:`Version ${version||"unspecified"}${url?` · ${url}`:""}`,status:"Source excerpt",createdAt:new Date().toISOString(),extra:{content:text.trim(),url:url.trim(),version:version.trim()}},...items]);setTitle("");setVersion("");setUrl("");setText("")}
  async function ask(e:FormEvent){
    e.preventDefault();if(!ready)return;const requestScope=searchScope;setSearching(true);setSearched(false);setAnswer("");setAnswerSources([]);setSearchMessage("");
    const local=retrievePolicyExcerpts(items.map(source=>({title:source.title,version:String(source.extra?.version??""),url:String(source.extra?.url??""),sourceType:"local" as const,content:String(source.extra?.content??"")})),query);
    const localSources:{title:string;version?:string;url?:string;content:string}[]=[];let localBudget=50_000;
    if(includeLocal)for(const source of items){const content=String(source.extra?.content??"");if(!content||content.length>20_000||content.length>localBudget)continue;localSources.push({title:source.title,version:String(source.extra?.version??"").slice(0,80),url:String(source.extra?.url??"").slice(0,2000),content});localBudget-=content.length;if(localSources.length===20)break}
    let account:RetrievedPolicyExcerpt[]=[];let generatedAnswer="";let generatedSources:RetrievedPolicyExcerpt[]=[];let generationMessage="";
    try{const response=await apiRequest<{answer:string|null;answerAvailable:boolean;generated:boolean;generationError:boolean;results:RetrievedPolicyExcerpt[]}>("/v1/policies/answer",{method:"POST",body:JSON.stringify({query,includeLocal,localSources})});account=response.results;if(response.generated&&response.answer){generatedAnswer=response.answer;generatedSources=response.results}else if(response.generationError)generationMessage="The answer provider is unavailable. Retrieved passages are shown below; no answer was generated.";else if(!response.answerAvailable)generationMessage="Answer generation is not configured on this API. Retrieved passages are shown below."}
    catch{generationMessage="Policy answer service unavailable; searched this device's saved excerpts only."}
    const seen=new Set<string>();
    const results=[...account,...local].sort((a,b)=>b.relevance-a.relevance).filter(hit=>{const key=`${hit.source}|${hit.version}|${hit.url}|${hit.excerpt}`;if(seen.has(key))return false;seen.add(key);return true}).slice(0,8);
    if(searchScopeRef.current!==requestScope)return;
    setAnswer(generatedAnswer);setAnswerSources(generatedSources);if(generationMessage)setSearchMessage(generationMessage);
    setHits(results);setHitsScope(requestScope);setSearched(true);setSearching(false);
  }
  return <div className="grid gap-5 lg:grid-cols-2"><Panel><div className="eyebrow text-muted">Retrieval augmented response</div><h2 className="mt-1 text-xl font-semibold">Ask about academic policy</h2><form onSubmit={ask} className="mt-5 space-y-3"><Field label="Question" maxLength={500} value={query} onChange={e=>setQuery(e.target.value)} required/><label className="flex items-start gap-3 rounded-xl bg-stone-50 p-3 text-xs leading-5 text-muted"><input type="checkbox" checked={includeLocal} onChange={e=>setIncludeLocal(e.target.checked)} className="mt-1 min-h-0 accent-blue-600"/><span>Include this device’s saved excerpts in the generated answer. When selected, their text is sent to the model provider configured by the API deployment. Otherwise local excerpts are searched locally and are not sent.</span></label><Button disabled={searching||!ready}>{searching?"Searching sources…":"Ask policy assistant"}</Button></form>{searchMessage&&<p role="status" className="mt-3 text-xs text-muted">{searchMessage}</p>}{answer&&hitsScope===searchScope&&<section className="mt-5 rounded-2xl bg-[#111] p-5 text-white"><div className="eyebrow text-white/50">AI-generated · verify with sources</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{answer}</p><div className="mt-5 border-t border-white/15 pt-4"><div className="eyebrow text-white/45">Cited evidence</div><ol className="mt-2 space-y-2 text-xs text-white/75">{answerSources.map((source,index)=><li key={`${source.source}-${index}`}>[{index+1}] {source.source}{source.version?` · ${source.version}`:""}{source.locator?` · ${source.locator}`:""}{source.url&&/^https?:\/\//i.test(source.url)?<> · <a className="underline" href={source.url} target="_blank" rel="noreferrer">Open source</a></>:null}</li>)}</ol></div></section>}<div className="mt-5 space-y-3">{visibleHits.length?visibleHits.map((hit,index)=><blockquote key={`${hit.source}-${index}`} className="rounded-xl border-l-2 border-blue-600 bg-stone-50 p-4 text-sm leading-6"><span className="mr-2 font-bold text-blue-700">[{index+1}]</span>“{hit.excerpt}”<footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted"><span>{hit.source}{hit.version?` · ${hit.version}`:""}{hit.locator?` · ${hit.locator}`:""} · {hit.sourceType==="account"?"Policy library":"This device"}</span>{hit.url&&/^https?:\/\//i.test(hit.url)&&<a href={hit.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">Open source ↗</a>}</footer></blockquote>):<p className="text-sm text-muted">{searched&&hitsScope===searchScope?"No matching passage was found in the sources available for this question.":"Add a source excerpt or search the account policy library."}</p>}</div></Panel><Panel><div className="eyebrow text-muted">Source library · {items.length}</div><h2 className="mt-1 text-xl font-semibold">Add policy source text</h2><form onSubmit={add} className="mt-5 space-y-3"><Field label="Document title" maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} required/><div className="grid gap-3 sm:grid-cols-2"><Field label="Version / year" maxLength={80} value={version} onChange={e=>setVersion(e.target.value)}/><Field label="Source URL (optional)" maxLength={2000} type="url" value={url} onChange={e=>setUrl(e.target.value)}/></div><label className="block text-sm font-medium">Policy text excerpt<textarea value={text} onChange={e=>setText(e.target.value)} required maxLength={20_000} rows={6} className="mt-2 w-full rounded-xl border border-rule bg-white p-3.5"/></label><Button disabled={!ready}>Save source</Button></form><p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Citations come from the account policy library or excerpts you save on this device. This assistant does not fetch policies or independently verify a publisher; confirm applicability with UPES. Device excerpts are sent to the model only when you explicitly opt in above.</p><LocalNote>{storageWarning||"Policy excerpts are saved only in this browser."}</LocalNote></Panel></div>;
}



function PlacementPage(){
  const {items,setItems,ready,storageKey:placementScope,storageWarning}=useSaved("placement-rules");
  const [cgpa,setCgpa]=useState("");const [backlogs,setBacklogs]=useState("");const [pct,setPct]=useState("");
  const [company,setCompany]=useState("");const [minCgpa,setMinCgpa]=useState("");const [maxBacklogs,setMaxBacklogs]=useState("");const [minPercent,setMinPercent]=useState("");const [url,setUrl]=useState("");const [confirmed,setConfirmed]=useState(false);
  const [recordSource,setRecordSource]=useState("Enter values below or sign in to load saved academic and backlog records.");
  const [criteriaSource,setCriteriaSource]=useState("Loading linked criteria…");
  useEffect(()=>{setCompany("");setMinCgpa("");setMaxBacklogs("");setMinPercent("");setUrl("");setConfirmed(false)},[placementScope]);
  const visibleCgpa=ready?cgpa:"";const visibleBacklogs=ready?backlogs:"";const visiblePercent=ready?pct:"";
  useEffect(()=>{
    setCgpa("");setBacklogs("");setPct("");setRecordSource("Enter values below or sign in to load saved academic and backlog records.");setCriteriaSource("Loading linked criteria…");
    if(!ready)return;
    let live=true;
    apiRequest<{records:{payload:{courses:{course:string;credits:number;gradePoints:number}[]}}[]}>("/v1/academics/records")
      .then(({records})=>{
        if(!live)return;
        const courses=records.flatMap(record=>record.payload.courses);
        if(courses.length){const cumulative=gpa(courses);if(cumulative!==null)setCgpa(cumulative.toFixed(2));setRecordSource("CGPA loaded from your saved semester course results; you can edit it below.")}
      }).catch(()=>undefined);
    apiRequest<{backlogs:{status:string}[]}>("/v1/backlogs")
      .then(({backlogs:records})=>{if(!live)return;setBacklogs(String(records.filter(record=>record.status!=="cleared").length));setRecordSource("Saved academic and backlog records loaded from your account where available; you can edit these values below.")})
      .catch(()=>undefined);
    apiRequest<{rules:{id:string;company:string;minCgpa:number|null;maxActiveBacklogs:number|null;minPercent:number|null;sourceTitle:string;sourceVersion:string;sourceUrl:string;sourceBatch:string|null}[] }>("/v1/placement/rules")
      .then(({rules})=>{
        if(!live)return;
        const linked:Saved[]=rules.map(rule=>({id:rule.id,title:rule.company,detail:rule.sourceUrl,status:"Verified database rule",createdAt:new Date().toISOString(),extra:{minCgpa:rule.minCgpa??"",maxBacklogs:rule.maxActiveBacklogs??"",minPercent:rule.minPercent??"",verified:true,sourceType:"account",sourceTitle:rule.sourceTitle,sourceVersion:rule.sourceVersion,sourceBatch:rule.sourceBatch??""}}));
        setItems(current=>[...linked,...current.filter(item=>item.extra?.sourceType!=="account")]);
        setCriteriaSource(linked.length?`${linked.length} verified, sourced criteria loaded from your account database.`:"No linked verified criteria are in the database yet; you can add a local notice below.");
      })
      .catch(()=>{if(live){setItems(current=>current.filter(item=>item.extra?.sourceType!=="account"));setCriteriaSource("Account criteria unavailable; showing locally saved thresholds.")}});
    return()=>{live=false};
  },[ready,placementScope]);
  function add(e:FormEvent){e.preventDefault();if(!ready)return;setItems([{id:crypto.randomUUID(),title:company,detail:url,status:confirmed&&url?"User marked verified":"Unverified",createdAt:new Date().toISOString(),extra:{minCgpa:minCgpa?Number(minCgpa):"",maxBacklogs:maxBacklogs?Number(maxBacklogs):"",minPercent:minPercent?Number(minPercent):"",verified:confirmed&&Boolean(url)}},...items]);setCompany("");setMinCgpa("");setMaxBacklogs("");setMinPercent("");setUrl("");setConfirmed(false)}
  const result=(rule:Saved)=>checkPlacement({minCgpa:typeof rule.extra?.minCgpa==="number"?rule.extra.minCgpa:null,maxActiveBacklogs:typeof rule.extra?.maxBacklogs==="number"?rule.extra.maxBacklogs:null,minPercent:typeof rule.extra?.minPercent==="number"?rule.extra.minPercent:null,verified:Boolean(rule.extra?.verified)},{cgpa:cgpa===""?null:Number(cgpa),activeBacklogs:backlogs===""?null:Number(backlogs),percent:pct===""?null:Number(pct)});
  return <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Panel><div className="eyebrow text-muted">Your current record</div><h2 className="mt-1 text-xl font-semibold">Readiness inputs</h2><p className="mt-2 text-xs text-muted" role="status">{ready?recordSource:"Loading records for this account…"}</p><div className="mt-5 space-y-4"><Field label="CGPA" type="number" min="0" step="any" value={visibleCgpa} onChange={e=>setCgpa(e.target.value)} disabled={!ready}/><Field label="Active backlogs" type="number" min="0" value={visibleBacklogs} onChange={e=>setBacklogs(e.target.value)} disabled={!ready}/><Field label="Aggregate percent (if notice requires it)" type="number" min="0" max="100" step="any" value={visiblePercent} onChange={e=>setPct(e.target.value)} disabled={!ready}/></div><LocalNote>Readiness inputs can load from your account records. The percent field must be entered from a verified transcript.</LocalNote></Panel><Panel><div className="eyebrow text-muted">Employer criteria</div><h2 className="mt-1 text-xl font-semibold">Add notice thresholds</h2><p className="mt-2 text-xs text-muted" role="status">{criteriaSource}</p><form onSubmit={add} className="mt-5 space-y-3"><Field label="Company / role" value={company} onChange={e=>setCompany(e.target.value)} required/><div className="grid gap-3 sm:grid-cols-3"><Field label="Minimum CGPA" type="number" min="0" step="any" value={minCgpa} onChange={e=>setMinCgpa(e.target.value)}/><Field label="Max backlogs" type="number" min="0" value={maxBacklogs} onChange={e=>setMaxBacklogs(e.target.value)}/><Field label="Minimum %" type="number" min="0" max="100" step="any" value={minPercent} onChange={e=>setMinPercent(e.target.value)}/></div><Field label="Official notice URL" type="url" value={url} onChange={e=>setUrl(e.target.value)} required/><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 min-h-0"/>I reviewed this threshold in the official notice.</label><Button disabled={!ready}>Save criteria</Button></form><p className="mt-3 text-xs leading-5 text-muted">Database criteria must be marked verified and linked to a current policy document. The portal does not independently confirm the publisher. Manually entered criteria stay on this device.</p><div className="mt-5 space-y-3">{items.map(rule=>{const status=result(rule);return <article key={rule.id} className="rounded-xl border border-rule p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{rule.title}</h3>{rule.extra?.sourceType==="account"&&<p className="mt-1 text-xs text-muted">{String(rule.extra.sourceTitle??"Policy source")}{rule.extra?.sourceVersion?` · ${String(rule.extra.sourceVersion)}`:""}{rule.extra?.sourceBatch?` · Batch ${String(rule.extra.sourceBatch)}`:""}</p>}</div><span className={`text-sm font-semibold ${status==="eligible"?"text-emerald-700":status==="not_eligible"?"text-red-700":"text-muted"}`}>{status==="eligible"?(rule.extra?.sourceType==="account"?"Meets linked criteria":"Meets entered criteria"):status==="not_eligible"?"Does not meet entered criteria":"Unknown · verify criteria"}</span></div>{/^https?:\/\//i.test(rule.detail)?<a className="mt-1 block truncate text-xs text-blue-700" href={rule.detail} target="_blank" rel="noopener noreferrer">{rule.detail}</a>:<p className="mt-1 truncate text-xs text-muted">{rule.detail}</p>}</article>})}</div><LocalNote>{storageWarning||"Placement criteria are saved only in this browser."}</LocalNote></Panel></div>;
}

function NotificationsPage(){
  const settingsKey=useStorageKey("notification-settings");
  const [state,setState]=useState({browser:true,quietStart:"22:00",quietEnd:"07:00",offsets:"1440,180,60"});
  const [ready,setReady]=useState(false);const [loadedKey,setLoadedKey]=useState("");
  const [permission,setPermission]=useState("default");const [saveMessage,setSaveMessage]=useState("");
  const scopeReady=ready&&loadedKey===settingsKey;const visibleState=scopeReady?state:{browser:true,quietStart:"22:00",quietEnd:"07:00",offsets:"1440,180,60"};const settingsScopeRef=useRef(settingsKey);useEffect(()=>{settingsScopeRef.current=settingsKey},[settingsKey]);
  useEffect(()=>{
    let live=true;setReady(false);setLoadedKey("");setSaveMessage("");
    const defaults={browser:true,quietStart:"22:00",quietEnd:"07:00",offsets:"1440,180,60"};
    let local=defaults;
    try{const stored=localStorage.getItem(settingsKey);if(stored){const parsed=JSON.parse(stored) as Partial<typeof defaults>;local={browser:parsed.browser??defaults.browser,quietStart:parsed.quietStart??defaults.quietStart,quietEnd:parsed.quietEnd??defaults.quietEnd,offsets:parsed.offsets??defaults.offsets}}}catch{}
    if("Notification"in window)setPermission(Notification.permission);
    apiRequest<{preferences:{quietStart:string|null;quietEnd:string|null;reminderOffsetsMinutes:number[];channels:string[]}|null}>("/v1/notification-preferences")
      .then(({preferences})=>{
        if(!live)return;
        const next=preferences?{browser:(preferences.channels.includes("local")||preferences.channels.includes("web_push")),quietStart:preferences.quietStart??"",quietEnd:preferences.quietEnd??"",offsets:preferences.reminderOffsetsMinutes.join(",")}:local;
        setState(next);setLoadedKey(settingsKey);setReady(true);
      })
      .catch(()=>{if(!live)return;setState(local);setLoadedKey(settingsKey);setReady(true)});
    return()=>{live=false};
  },[settingsKey]);
  useEffect(()=>{if(ready&&loadedKey===settingsKey&&!writeLocalStorage(settingsKey,JSON.stringify(state)))setSaveMessage("Browser storage is blocked; preference changes last only for this page session.")},[state,ready,loadedKey,settingsKey]);
  async function enable(){
    if(typeof Notification==="undefined"){setSaveMessage("Browser notifications are not supported in this browser.");return}
    try{
      const result=await Notification.requestPermission();setPermission(result);
      setSaveMessage(result==="granted"?"Browser notification permission is enabled.":"Browser notification permission was not granted.");
    }catch{setSaveMessage("Browser notification permission could not be requested in this context.")}
  }
  function test(){
    if(typeof Notification==="undefined"){setSaveMessage("Browser notifications are not supported in this browser.");return}
    if(permission!=="granted"){setSaveMessage("Enable browser notification permission before sending a test.");return}
    try{new Notification("UPES Companion reminder",{body:"Browser notifications are enabled on this device."});setSaveMessage("Test browser notification sent.")}
    catch{setSaveMessage("The browser could not display a notification; check its site notification settings.")}
  }
  async function save(){
    if(!scopeReady)return;
    const requestScope=settingsKey;
    let offsets:number[];
    try{offsets=parseReminderOffsets(state.offsets)}catch(error){setSaveMessage(error instanceof Error?error.message:"Reminder offsets are invalid.");return}
    const payload={quietStart:state.quietStart||null,quietEnd:state.quietEnd||null,channels:["in_app","alarm",...(state.browser?["local"]:[])],reminderOffsetsMinutes:offsets};
    try{await apiRequest("/v1/notification-preferences",{method:"PUT",body:JSON.stringify(payload)});if(settingsScopeRef.current===requestScope)setSaveMessage("Preferences saved to your account.")}
    catch{if(settingsScopeRef.current===requestScope)setSaveMessage("Preferences saved in this browser. Account sync is unavailable.")}
  }
  return <div className="grid gap-5 lg:grid-cols-2"><Panel><div className="eyebrow text-muted">Delivery preferences</div><h2 className="mt-1 text-xl font-semibold">Reminders on this device</h2><label className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-stone-50 p-4"><span><strong className="block text-sm">Browser notifications</strong><span className="text-xs text-muted">Permission: {permission}</span></span><input type="checkbox" checked={visibleState.browser} onChange={e=>setState({...state,browser:e.target.checked})} disabled={!scopeReady} className="h-5 w-5 min-h-0 accent-blue-600"/></label><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Quiet hours start" type="time" value={visibleState.quietStart} disabled={!scopeReady} onChange={e=>setState({...state,quietStart:e.target.value})}/><Field label="Quiet hours end" type="time" value={visibleState.quietEnd} disabled={!scopeReady} onChange={e=>setState({...state,quietEnd:e.target.value})}/></div><Field className="mt-4" label="Reminder offsets (whole minutes, comma separated)" inputMode="numeric" value={visibleState.offsets} disabled={!scopeReady} onChange={e=>setState({...state,offsets:e.target.value})}/><p className="mt-2 text-xs text-muted">Enter up to 10 offsets from 1 to 43,200 minutes; leave blank to disable automatic offsets. Quiet hours apply while the portal is open. New assignments use future offsets unless you set a specific alarm.</p><div className="mt-4 flex flex-wrap gap-3"><Button onClick={enable}>Enable browser permission</Button><button onClick={test} className="rounded-xl border border-rule px-4 py-2.5 text-sm font-semibold">Send test</button><Button onClick={save} disabled={!scopeReady}>Save preferences</Button></div>{saveMessage&&<p role="status" className="mt-3 text-sm text-muted">{saveMessage}</p>}<p className="mt-4 text-xs leading-5 text-muted">Closed-app delivery and push registration require a service worker and push backend.</p><LocalNote>Settings save to this browser and to the account API when signed in.</LocalNote></Panel><ReminderSchedulePreview/></div>
}

function ReminderSchedulePreview(){
  const storageKey=useStorageKey("assignments");
  const [items,setItems]=useState<Assignment[]>([]);
  const [loadedKey,setLoadedKey]=useState("");
  const [now,setNow]=useState(()=>Date.now());
  const scopeReady=loadedKey===storageKey;
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30_000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{
    let live=true;
    setLoadedKey("");
    let cached:Assignment[]=[];
    cached=readAssignments(storageKey);
    apiRequest<{assignments:{id:string;title:string;courseCode:string|null;dueAt:string|null;status:string;source:string}[]}>("/v1/assignments")
      .then(({assignments})=>{
        if(!live)return;
        const localById=new Map(cached.map(item=>[item.id,item]));
        const remote=assignments.map(item=>{const local=localById.get(item.id);return{id:item.id,title:item.title,course:item.courseCode??"",due:item.dueAt??"",alarm:local?.alarm??"",reminders:local?.reminders??[],priority:local?.priority??"Normal",status:assignmentUiStatus(item.status),source:item.source,accountRecord:true}});
        setItems([...remote,...cached.filter(item=>!item.accountRecord&&!remote.some(row=>row.id===item.id))]);
        setLoadedKey(storageKey);
      })
      .catch(()=>{if(live){setItems(cached);setLoadedKey(storageKey)}});
    return()=>{live=false};
  },[storageKey]);
  const upcoming=scopeReady?items.filter(item=>item.alarm&&Date.parse(item.alarm)>now&&item.status!=="Completed").sort((a,b)=>Date.parse(a.alarm)-Date.parse(b.alarm)).slice(0,5):[];
  return <Panel className="bg-[#111] text-white"><div className="eyebrow text-white/50">Scheduled assignment alarms</div><h2 className="mt-1 text-xl font-semibold">Next reminders</h2><div className="mt-5 space-y-3">{!scopeReady?<p className="text-sm text-white/60">Loading your assignment alarms…</p>:upcoming.length?upcoming.map(item=><article key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[.04] p-4"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{item.title}</h3><p className="mt-1 text-xs text-white/55">{item.course||"Assignment"}{item.due?` · Due ${new Date(item.due).toLocaleString()}`:""}</p></div><time className="shrink-0 text-right text-xs font-semibold text-blue-300">{new Date(item.alarm).toLocaleString([], {weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</time></article>):<p className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm text-white/60">No upcoming alarms are scheduled. Set an alarm on an assignment to add one here.</p>}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-white/40">Reminders run while the portal is open.</span><Link href="/assignments" className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Manage alarms ↗</Link></div></Panel>;
}

function uiStatus(value:string){if(value==="directed_reading")return"Directed Reading";if(value==="not_eligible")return"Not eligible";return value.replaceAll("_"," ").replace(/^\w/,char=>char.toUpperCase())}
function apiStatus(value:string){return value.toLowerCase().replaceAll(" ","_")}
function assignmentUiStatus(value:string):Assignment["status"]{return value==="completed"?"Completed":value==="in_progress"?"In progress":value==="overdue"?"Overdue":"Open"}
function ConnectedDirectedReadingPage(){const {items,setItems,ready,storageKey,storageWarning}=useSaved("directed-reading");const [course,setCourse]=useState("");const [guide,setGuide]=useState("");const [message,setMessage]=useState("Loading account records…");const [remoteReady,setRemoteReady]=useState(false);useEffect(()=>{setCourse("");setGuide("")},[storageKey]);useEffect(()=>{if(!ready){setRemoteReady(false);return}let live=true;setRemoteReady(false);apiRequest<{applications:{id:string;courseCode:string;facultyGuide:string|null;status:string;createdAt:string}[]}>("/v1/directed-reading").then(({applications})=>{if(!live)return;const remote=applications.map(x=>({id:x.id,title:x.courseCode,detail:x.facultyGuide||"Faculty guide not recorded",status:uiStatus(x.status),createdAt:x.createdAt,accountRecord:true}));setItems(current=>[...remote,...current.filter(x=>!remote.some(r=>r.id===x.id))]);setMessage("Directed Reading records load from your account database.");setRemoteReady(true)}).catch(()=>{if(live){setMessage("Browser storage is active. Sign in and configure the API to sync records.");setRemoteReady(true)}});return()=>{live=false}},[ready]);async function add(e:FormEvent){e.preventDefault();if(!ready||!remoteReady)return;const normalizedCourse=course.trim();const normalizedGuide=guide.trim();if(!normalizedCourse){setMessage("Enter a course code or title.");return}const draft:Saved={id:crypto.randomUUID(),title:normalizedCourse,detail:normalizedGuide||"Faculty guide not recorded",status:"Draft",createdAt:new Date().toISOString(),accountRecord:false};try{const result=await apiRequest<{application:{id:string;status:string;createdAt:string}}>("/v1/directed-reading",{method:"POST",body:JSON.stringify({courseCode:normalizedCourse,facultyGuide:normalizedGuide||null})});draft.id=result.application.id;draft.createdAt=result.application.createdAt;draft.status=uiStatus(result.application.status);draft.accountRecord=true;setMessage("Application saved to your account database. Status is for personal tracking; it does not submit to faculty.")}catch{setMessage("Application saved in this browser only. API sync is unavailable.")}setItems(current=>[draft,...current.filter(item=>item.id!==draft.id)]);setCourse("");setGuide("")}async function update(id:string,status:string){if(!ready||!remoteReady)return;const item=items.find(x=>x.id===id);setItems(current=>current.map(x=>x.id===id?{...x,status}:x));if(!item?.accountRecord){setMessage("Status saved on this device only.");return}try{await apiRequest(`/v1/directed-reading/${id}`,{method:"PATCH",body:JSON.stringify({status:apiStatus(status)})});setMessage("Status saved to your account database.")}catch{setMessage("Status changed in this browser only; account sync is unavailable.")}}return <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Panel><div className="eyebrow text-muted">New application</div><h2 className="mt-1 text-xl font-semibold">Track directed reading</h2><form onSubmit={add} className="mt-5 space-y-4"><Field label="Course code / title" maxLength={80} value={course} onChange={e=>setCourse(e.target.value)} required/><Field label="Faculty guide" maxLength={240} value={guide} onChange={e=>setGuide(e.target.value)}/><Button className="w-full" disabled={!ready||!remoteReady}>Add application</Button></form><p className="mt-4 text-xs text-muted">Statuses are personal tracking only and do not submit anything to faculty.</p><LocalNote>{[message,storageWarning].filter(Boolean).join(" ")}</LocalNote></Panel><Panel><div className="eyebrow text-muted">Applications</div><h2 className="mt-1 text-xl font-semibold">Progress</h2><div className="mt-5 space-y-3">{items.length===0?<Empty text={ready&&remoteReady?"No directed reading applications added.":"Loading account records…"}/>:items.map(x=><article key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule p-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{x.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${x.accountRecord?"bg-stone-100 text-muted":"bg-amber-50 text-amber-800"}`}>{x.accountRecord?"Account":"Device only"}</span></div><p className="text-sm text-muted">Guide: {x.detail}</p></div><SelectField label="Status" disabled={!ready||!remoteReady} value={x.status} onChange={e=>void update(x.id,e.target.value)}><option>Draft</option><option>Submitted</option><option>Approved</option><option>Rejected</option><option>Completed</option></SelectField></article>)}</div></Panel></div>}
function ConnectedBacklogsPage(){const {items,setItems,ready,storageKey,storageWarning}=useSaved("backlogs");const [courseCode,setCourseCode]=useState("");const [courseName,setCourseName]=useState("");const [semester,setSemester]=useState("");const [attempt,setAttempt]=useState("1");const [plan,setPlan]=useState("2");const [message,setMessage]=useState("Loading account records…");const [remoteReady,setRemoteReady]=useState(false);useEffect(()=>{setCourseCode("");setCourseName("");setSemester("");setAttempt("1")},[storageKey]);useEffect(()=>{if(!ready){setRemoteReady(false);return}let live=true;setRemoteReady(false);apiRequest<{backlogs:{id:string;courseCode:string;courseName:string;originalSemester:number;attempts:number;status:string;source:string}[]}>("/v1/backlogs").then(({backlogs})=>{if(!live)return;const remote=backlogs.map(x=>({id:x.id,title:x.courseName,detail:`${x.courseCode} · Original semester ${x.originalSemester} · attempt ${x.attempts}`,status:uiStatus(x.status),createdAt:new Date().toISOString(),extra:{semester:x.originalSemester,attempt:x.attempts,courseCode:x.courseCode},accountRecord:true}));setItems(current=>[...remote,...current.filter(x=>!remote.some(r=>r.id===x.id))]);setMessage("Backlog records load from your account database.");setRemoteReady(true)}).catch(()=>{if(live){setMessage("Browser storage is active. Sign in and configure the API to sync records.");setRemoteReady(true)}});return()=>{live=false}},[ready]);async function add(e:FormEvent){e.preventDefault();if(!ready||!remoteReady)return;const normalizedCourseCode=courseCode.trim();const normalizedCourseName=courseName.trim();if(!normalizedCourseCode||!normalizedCourseName){setMessage("Enter both the course code and course name.");return}const local:Saved={id:crypto.randomUUID(),title:normalizedCourseName,detail:`${normalizedCourseCode} · Original semester ${semester} · attempt ${attempt}`,status:"Pending",createdAt:new Date().toISOString(),extra:{semester:Number(semester),attempt:Number(attempt),courseCode:normalizedCourseCode},accountRecord:false};try{const result=await apiRequest<{backlog:{id:string;courseCode:string;courseName:string;status:string;originalSemester:number;attempts:number}}>("/v1/backlogs",{method:"POST",body:JSON.stringify({courseCode:normalizedCourseCode,courseName:normalizedCourseName,originalSemester:Number(semester),attempts:Number(attempt)})});local.id=result.backlog.id;local.title=result.backlog.courseName;local.detail=`${result.backlog.courseCode} · Original semester ${result.backlog.originalSemester} · attempt ${result.backlog.attempts}`;local.extra={semester:result.backlog.originalSemester,attempt:result.backlog.attempts,courseCode:result.backlog.courseCode};local.status=uiStatus(result.backlog.status);local.accountRecord=true;setMessage("Backlog saved to your account database.")}catch{setMessage("Backlog saved in this browser only. API sync is unavailable.")}setItems(current=>[local,...current.filter(item=>item.id!==local.id)]);setCourseCode("");setCourseName("");setSemester("")}async function change(id:string,status:string){if(!ready||!remoteReady)return;const item=items.find(x=>x.id===id);setItems(current=>current.map(x=>x.id===id?{...x,status}:x));if(!item?.accountRecord){setMessage("Status saved on this device only.");return}try{await apiRequest(`/v1/backlogs/${id}`,{method:"PATCH",body:JSON.stringify({status:apiStatus(status)})});setMessage("Status saved to your account database.")}catch{setMessage("Status changed in this browser only; account sync is unavailable.")}}const pending=items.filter(x=>x.status!=="Cleared");return <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Panel><div className="eyebrow text-muted">Add record</div><h2 className="mt-1 text-xl font-semibold">Backlog course</h2><form onSubmit={add} className="mt-5 space-y-4"><Field label="Course code" maxLength={80} value={courseCode} onChange={e=>setCourseCode(e.target.value)} required/><Field label="Course name" maxLength={240} value={courseName} onChange={e=>setCourseName(e.target.value)} required/><Field label="Original semester" type="number" min="1" max="16" value={semester} onChange={e=>setSemester(e.target.value)} required/><Field label="Attempt number" type="number" min="1" max="30" value={attempt} onChange={e=>setAttempt(e.target.value)} required/><Button className="w-full" disabled={!ready||!remoteReady}>Add backlog</Button></form><div className="mt-6 rounded-xl bg-black p-4 text-white"><div className="eyebrow text-white/50">Clearance plan</div><p className="mt-2 text-sm text-white/70">At {plan} planned course{plan==="1"?"":"s"} per attempt, {pending.length} pending subject{pending.length===1?"":"s"} would take approximately <strong className="text-white">{pending.length?Math.ceil(pending.length/Math.max(1,Number(plan)||1)):0} attempt window(s)</strong>.</p><Field label="Planned courses per attempt" type="number" min="1" value={plan} onChange={e=>setPlan(e.target.value)}/></div><p className="mt-3 text-xs text-muted">Planning estimate only; registration and clearance depend on official rules and schedules.</p><LocalNote>{[message,storageWarning].filter(Boolean).join(" ")}</LocalNote></Panel><Panel><div className="eyebrow text-muted">Backlog register</div><h2 className="mt-1 text-xl font-semibold">{pending.length} pending</h2><div className="mt-5 space-y-3">{items.length===0?<Empty text={ready&&remoteReady?"No backlog courses entered.":"Loading account records…"} />:items.map(x=><article key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule p-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{x.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${x.accountRecord?"bg-stone-100 text-muted":"bg-amber-50 text-amber-800"}`}>{x.accountRecord?"Account":"Device only"}</span></div><p className="text-sm text-muted">{x.detail}</p></div><SelectField label="Status" disabled={!ready||!remoteReady} value={x.status} onChange={e=>void change(x.id,e.target.value)}><option>Pending</option><option>Registered</option><option>Directed Reading</option><option>Cleared</option><option>Not eligible</option></SelectField></article>)}</div></Panel></div>}
function SettingsPage(){
  const profileScope=useStorageKey("student-profile");
  const latestProfileScope=useRef(profileScope);
  useEffect(()=>{latestProfileScope.current=profileScope},[profileScope]);
  
  const [profile,setProfile]=useState<Profile>(EMPTY_PROFILE);
  const [loadedScope,setLoadedScope]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const profileReady=loadedScope===profileScope;
  useEffect(()=>{
    let live=true;
    setLoadedScope("");setProfile(EMPTY_PROFILE);setMessage("Loading account profile…");
    apiRequest<{student:Profile}>("/v1/me")
      .then(({student})=>{if(live){setProfile(student);setLoadedScope(profileScope);setMessage("")}})
      .catch(error=>{if(live){setProfile(EMPTY_PROFILE);setLoadedScope(profileScope);setMessage(error instanceof Error?error.message:"Could not load profile.")}});
    return()=>{live=false};
  },[profileScope]);
  async function save(e:FormEvent){
    e.preventDefault();if(!profileReady)return;const requestScope=profileScope;const name=profile.name?.trim()??"";const studentId=profile.universityId?.trim()??"";if(!name||!studentId){setMessage("Enter a name and student ID using at least one non-space character.");return}setBusy(true);setMessage("");
    try{
      const body={studentId,name,department:profile.department,degree:profile.degree,specialization:profile.specialization,batch:profile.batch,currentSemester:profile.currentSemester,academicYear:profile.academicYear};
      const result=await apiRequest<{student:Profile}>("/v1/me",{method:"PUT",body:JSON.stringify(body)});
      if(latestProfileScope.current===requestScope){setProfile(result.student);setMessage("Profile saved to your account.")}
    }catch(error){if(latestProfileScope.current===requestScope)setMessage(error instanceof Error?error.message:"Could not save profile.")}
    finally{setBusy(false)}
  }
  const current=profileReady?profile:EMPTY_PROFILE;
  return <Panel className="max-w-3xl"><div className="eyebrow text-muted">Authenticated profile</div><h2 className="mt-1 text-xl font-semibold">Student academic record</h2><p className="mt-2 text-sm text-muted">This profile is stored in the API database. Your email is managed by Supabase Auth.</p><form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Full name" value={current.name??""} onChange={e=>setProfile({...current,name:e.target.value})} required disabled={!profileReady}/><Field label="Student / university ID" value={current.universityId??""} onChange={e=>setProfile({...current,universityId:e.target.value})} required disabled={!profileReady}/><Field label="Department" value={current.department??""} onChange={e=>setProfile({...current,department:e.target.value})} disabled={!profileReady}/><Field label="Degree" value={current.degree??""} onChange={e=>setProfile({...current,degree:e.target.value})} disabled={!profileReady}/><Field label="Specialization" value={current.specialization??""} onChange={e=>setProfile({...current,specialization:e.target.value})} disabled={!profileReady}/><Field label="Batch" value={current.batch??""} onChange={e=>setProfile({...current,batch:e.target.value})} disabled={!profileReady}/><Field label="Current semester" type="number" min="1" max="16" value={current.currentSemester??""} onChange={e=>setProfile({...current,currentSemester:e.target.value?Number(e.target.value):null})} disabled={!profileReady}/><Field label="Academic year" value={current.academicYear??""} onChange={e=>setProfile({...current,academicYear:e.target.value})} disabled={!profileReady}/><div className="sm:col-span-2"><Button disabled={busy||!profileReady}>{busy?"Saving…":"Save profile"}</Button>{message&&<p role="status" className="mt-3 text-sm text-muted">{message} · API: {configuredApiUrl()}</p>}</div></form></Panel>;
}
function Empty({text}:{text:string}){return <div className="rounded-xl bg-stone-50 px-4 py-8 text-center text-sm text-muted">{text}</div>}

export function FeatureWorkspace({ section }: { section: string }) {
  const known = Object.prototype.hasOwnProperty.call(labels, section);
  if (!known) return <div className="mx-auto max-w-4xl py-14 text-center"><div className="eyebrow text-muted">Page unavailable</div><h1 className="mt-2 text-3xl font-semibold">This area is not available.</h1><Link href="/" className="mt-5 inline-block text-blue-700">Return to dashboard</Link></div>;
  return <div className="mx-auto max-w-6xl"><Heading section={section}/>{section==="academics"?<AcademicPage/>:section==="assignments"?<AssignmentsPage/>:section==="calendar"?<CalendarPage/>:section==="policy"?<PolicyPage/>:section==="directed-reading"?<ConnectedDirectedReadingPage/>:section==="backlogs"?<ConnectedBacklogsPage/>:section==="placement"?<PlacementPage/>:section==="notifications"?<NotificationsPage/>:<SettingsPage/>}</div>;
}
