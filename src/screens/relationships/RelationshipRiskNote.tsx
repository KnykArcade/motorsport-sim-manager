export function RelationshipRiskNote({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <div className="mt-2 rounded border border-current/15 bg-neutral-950/30 px-2.5 py-2 text-[10px] leading-relaxed text-neutral-400">
      <span className="font-bold uppercase tracking-wide text-neutral-300">If ignored · </span>
      {children}
    </div>
  );
}
