import type { KeyboardEvent, ReactNode } from 'react';

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
  items: ReadonlyArray<{ id: T; label: string; disabled?: boolean; disabledReason?: string }>;
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    ).filter((button) => button.getAttribute('aria-disabled') !== 'true');
    if (!buttons.length) return;
    const currentIndex = buttons.indexOf(event.currentTarget);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  return (
    <div className="ui-workspace-tabs flex shrink-0 items-center overflow-x-auto" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          onClick={() => {
            if (!item.disabled) onChange(item.id);
          }}
          title={item.disabled ? item.disabledReason : undefined}
          aria-selected={active === item.id}
          aria-disabled={item.disabled || undefined}
          aria-label={item.disabled && item.disabledReason
            ? `${item.label}. Unavailable: ${item.disabledReason}`
            : undefined}
          onKeyDown={moveFocus}
          tabIndex={active === item.id ? 0 : -1}
          className={active === item.id ? 'is-active' : ''}
        >
          {item.label}
        </button>
      ))}
    </div>
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
