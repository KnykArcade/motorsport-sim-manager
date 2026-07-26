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
