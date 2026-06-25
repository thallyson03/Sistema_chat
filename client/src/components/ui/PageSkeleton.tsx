function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-container-highest ${className}`}
      aria-hidden
    />
  );
}

export function PageLoadingFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <SkeletonBar className="h-8 w-48" />
      <SkeletonBar className="h-4 w-72" />
      <div className="mt-4 grid gap-3">
        <SkeletonBar className="h-24 w-full" />
        <SkeletonBar className="h-24 w-full" />
        <SkeletonBar className="h-24 w-full" />
      </div>
    </div>
  );
}

export function AuthBootSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 flex-col border-r border-primary/10 bg-surface-container-lowest p-4">
        <SkeletonBar className="mb-6 h-12 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBar key={i} className="h-9 w-full" />
          ))}
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-on-surface-variant">Carregando...</p>
      </main>
    </div>
  );
}

export function ConversationsSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="flex w-full max-w-md flex-col border-r border-outline-variant/40 p-3 md:w-96">
        <SkeletonBar className="mb-3 h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBar key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
      <div className="hidden flex-1 flex-col p-4 md:flex">
        <SkeletonBar className="mb-4 h-12 w-full" />
        <div className="flex-1 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBar key={i} className={`h-10 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'} ml-auto`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PipelinesSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex h-[calc(100vh-60px)] flex-col gap-4 bg-surface px-5 py-5">
      <div className="flex gap-3">
        <SkeletonBar className="h-10 w-48" />
        <SkeletonBar className="h-10 w-32" />
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex min-w-[260px] flex-1 flex-col gap-2 rounded-xl bg-surface-container-low p-3">
            <SkeletonBar className="h-6 w-3/4" />
            <SkeletonBar className="h-20 w-full" />
            <SkeletonBar className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBar key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
