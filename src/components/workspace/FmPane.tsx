import type { ReactNode } from 'react';

export function FmPane({
  children,
  className = '',
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section className={`ui-fm-pane min-h-0 min-w-0 ${className}`} aria-label={ariaLabel}>
      {children}
    </section>
  );
}

export function FmPaneHeader({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ui-fm-pane-header">
      <div className="min-w-0">
        <div className="ui-fm-pane-title">{title}</div>
        {meta && <div className="ui-fm-pane-meta">{meta}</div>}
      </div>
      {actions && <div className="ui-fm-pane-actions">{actions}</div>}
    </header>
  );
}

export function FmPaneBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`ui-fm-pane-body min-h-0 ${className}`}>{children}</div>;
}

export function FmWorkspaceGrid({
  children,
  className = '',
  columns = 'three',
}: {
  children: ReactNode;
  className?: string;
  columns?: 'two' | 'three';
}) {
  return (
    <div className={`ui-fm-workspace-grid is-${columns} min-h-0 ${className}`}>
      {children}
    </div>
  );
}

export function FmListButton({
  children,
  active = false,
  urgent = false,
  onClick,
  className = '',
}: {
  children: ReactNode;
  active?: boolean;
  urgent?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ui-fm-list-button ${active ? 'is-active' : ''} ${urgent ? 'is-urgent' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function FmKeyValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="ui-fm-key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function FmDecisionBar({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <footer className="ui-fm-decision-bar">
      <div className="min-w-0">{children}</div>
      {actions && <div className="ui-fm-decision-actions">{actions}</div>}
    </footer>
  );
}
