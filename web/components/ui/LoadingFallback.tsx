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

export function ChartSkeleton({ height = 252 }: { height?: number }) {
  return (
    <div
      className="loading-shimmer rounded-lg min-w-[320px] w-full"
      style={{ height }}
      aria-hidden
    />
  );
}
