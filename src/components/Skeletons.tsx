/** Scheda-fantasma mostrata durante il caricamento della libreria. */
export function BookCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl border border-stone-700/70 light:border-stone-200 bg-stone-800/40 light:bg-white p-3 sm:p-4 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden="true"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="shrink-0 w-20 lg:w-24 aspect-[2/3] rounded-lg bg-stone-700/60 light:bg-stone-200" />
        <div className="flex-1 min-w-0 space-y-3 pt-1">
          <div className="h-5 w-4/5 rounded-md bg-stone-700/60 light:bg-stone-200" />
          <div className="h-3.5 w-1/2 rounded-md bg-stone-700/40 light:bg-stone-200/80" />
          <div className="flex gap-1.5 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 w-4 rounded-sm bg-stone-700/40 light:bg-stone-200/80" />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-3">
            <div className="h-6 w-24 rounded-full bg-stone-700/50 light:bg-stone-200" />
            <div className="h-6 w-24 rounded-full bg-stone-700/40 light:bg-stone-200/80" />
            <div className="h-6 w-16 rounded-full bg-stone-700/40 light:bg-stone-200/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <div role="status" aria-label="Caricamento della tua libreria" className="space-y-4">
      <div className="h-6 w-48 rounded-md bg-stone-700/50 light:bg-stone-200 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <BookCardSkeleton key={i} delay={i * 120} />
        ))}
      </div>
    </div>
  );
}
