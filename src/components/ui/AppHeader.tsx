export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/95 shadow-sm shadow-neutral-200/70 backdrop-blur">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-3 sm:px-4 lg:px-5 2xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-800 shadow-sm">
            FC
          </span>
          <div className="min-w-0">
            <span className="block text-xl font-semibold leading-tight text-neutral-950">
              FlowCode
            </span>
            <span className="block truncate text-xs font-medium text-neutral-500">
              Editor visual de algoritmos
            </span>
          </div>
        </div>
        <span className="hidden rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 sm:inline-flex">
          Ejecucion paso a paso
        </span>
      </div>
    </header>
  );
}
