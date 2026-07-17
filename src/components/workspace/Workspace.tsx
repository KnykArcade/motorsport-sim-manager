import type { ReactNode } from 'react';

export function WorkspaceScreen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ui-workspace-screen flex min-h-full flex-col gap-3 ${className}`}>{children}</div>;
}

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ui-workspace-header flex shrink-0 items-center justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="ui-workspace-eyebrow">{eyebrow}</div>}
        <h1 className="truncate text-xl font-black tracking-tight text-neutral-100">{title}</h1>
        {subtitle && <div className="mt-0.5 truncate text-xs text-neutral-400">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function WorkspaceTabs<T extends string>({
  items,
  active,
  onChange,
  ariaLabel,
}: {
  items: ReadonlyArray<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <nav className="ui-workspace-tabs flex shrink-0 items-center overflow-x-auto" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-current={active === item.id ? 'page' : undefined}
          className={active === item.id ? 'is-active' : ''}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function MetricStrip({ children }: { children: ReactNode }) {
  return <div className="ui-metric-strip grid shrink-0 grid-cols-2 md:grid-cols-4">{children}</div>;
}

export function WorkspaceMetric({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="ui-workspace-metric min-w-0">
      <div className="ui-workspace-metric-label">{label}</div>
      <div className="ui-workspace-metric-value truncate">{value}</div>
      {detail && <div className="ui-workspace-metric-detail truncate">{detail}</div>}
    </div>
  );
}

export function WorkspaceBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ui-workspace-body min-h-0 flex-1 overflow-auto ${className}`}>{children}</div>;
}
