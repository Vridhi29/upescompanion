export function MockBanner() {
  return (
    <div role="note" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-950 sm:px-5">
      <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-200 text-xs font-bold">i</span>
      <p><strong className="font-semibold">Sample data.</strong> These numbers are invented for development. UPES portal
      sync is not connected yet, so nothing here is your real attendance.</p>
    </div>
  );
}
