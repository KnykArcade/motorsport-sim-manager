import type { ReactNode } from 'react';

type Props = {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, actions, children, className = '' }: Props) {
  return (
    <section className={`era-panel rounded-xl border border-neutral-800 bg-neutral-900/40 ${className}`}>
      {(title || actions) && (
        <header className="era-panel-header flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="era-panel-body p-4">{children}</div>
    </section>
  );
}
