import type { RelationshipManagementMove } from './relationshipActionViewModel';

type Props = {
  preview: RelationshipManagementMove['preview'];
};

export function RelationshipActionPreview({ preview }: Props) {
  return (
    <div className="mt-2 grid gap-1.5 text-[9px] text-neutral-500 sm:grid-cols-3">
      <PreviewCell label="Target" value={preview.target} />
      <PreviewCell label="Expected change" value={preview.expectedChange} />
      <PreviewCell label="Constraint" value={preview.constraint} />
    </div>
  );
}

function PreviewCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/35 px-2 py-1.5">
      <div className="font-bold uppercase tracking-wide text-neutral-600">{label}</div>
      <div className="mt-0.5 leading-relaxed text-neutral-400">{value}</div>
    </div>
  );
}
