export function LoadingFallback() {
  return <p className="text-muted text-sm">加载中…</p>;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="notebook min-h-[280px]" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="notebook-row loading-shimmer min-h-[56px]"
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <section
      className="mb-3 pb-3 border-b border-line/50 min-h-[88px]"
      aria-label="月度汇总加载中"
      aria-busy
    >
      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`loading-shimmer h-4 rounded ${i === 1 ? 'row-span-2 w-px justify-self-center' : ''}`}
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </section>
  );
}

export function ChartSkeleton({ height = 252 }: { height?: number }) {
  return (
    <div
      className="loading-shimmer rounded-lg min-w-[320px] w-full"
      style={{ height }}
      aria-hidden
    />
  );
}
