export function Skeleton() {
  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="h-3.5 rounded animate-shimmer" style={{ width: '75%' }} />
      <div className="h-3.5 rounded animate-shimmer" style={{ width: '100%' }} />
      <div className="h-3.5 rounded animate-shimmer" style={{ width: '90%' }} />
      <div className="h-3.5 rounded animate-shimmer" style={{ width: '60%' }} />
      <div className="h-20 rounded-lg animate-shimmer" />
      <div className="h-3.5 rounded animate-shimmer" style={{ width: '80%' }} />
      <div className="h-3.5 rounded animate-shimmer" style={{ width: '50%' }} />
    </div>
  );
}
