type RelationshipRiskNoteProps = {
  children?: string;
  priorityContext?: string;
};

export function RelationshipRiskNote({ children, priorityContext }: RelationshipRiskNoteProps) {
  if (!children) return null;
  return (
    <div className="mt-2 rounded border border-current/15 bg-neutral-950/30 px-2.5 py-2 text-[10px] leading-relaxed text-neutral-400">
      {priorityContext && (
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-neutral-500">
          Priority logic · {priorityContext}
        </div>
      )}
      <div>
        <span className="font-bold uppercase tracking-wide text-neutral-300">If ignored · </span>
        {children}
      </div>
    </div>
  );
}
