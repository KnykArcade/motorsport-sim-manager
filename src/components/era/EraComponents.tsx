import type { ButtonHTMLAttributes, ReactNode, TableHTMLAttributes } from 'react';
import { useEraTheme } from '../../theme/useEraTheme';
import type { MotorsportEraTheme } from '../../theme/eraTheme';

type EraProp = {
  era?: MotorsportEraTheme;
};

function useEraId(era?: MotorsportEraTheme): MotorsportEraTheme {
  const theme = useEraTheme();
  return era ?? theme.id;
}

export function EraShell({ era, children, className = '' }: EraProp & { children: ReactNode; className?: string }) {
  const eraId = useEraId(era);
  return (
    <div className={`era-shell ${className}`} data-era={eraId}>
      {children}
    </div>
  );
}

export function EraPanel({
  era,
  title,
  actions,
  children,
  className = '',
}: EraProp & { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  const eraId = useEraId(era);
  return (
    <section className={`era-panel ${className}`} data-era={eraId}>
      {(title || actions) && (
        <header className="era-panel-header">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      <div className="era-panel-body">{children}</div>
    </section>
  );
}

export function EraButton({
  era,
  variant = 'secondary',
  className = '',
  children,
  ...rest
}: EraProp &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    children: ReactNode;
  }) {
  const eraId = useEraId(era);
  return (
    <button {...rest} className={`era-button era-button-${variant} ${className}`} data-era={eraId}>
      {children}
    </button>
  );
}

export function EraTabs({ era, children, className = '' }: EraProp & { children: ReactNode; className?: string }) {
  const eraId = useEraId(era);
  return (
    <div className={`era-tabs ${className}`} data-era={eraId}>
      {children}
    </div>
  );
}

export function EraTable({
  era,
  className = '',
  children,
  ...rest
}: EraProp & TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  const eraId = useEraId(era);
  return (
    <table {...rest} className={`era-table ${className}`} data-era={eraId}>
      {children}
    </table>
  );
}

export function EraKpi({
  era,
  label,
  value,
  className = '',
}: EraProp & { label: ReactNode; value: ReactNode; className?: string }) {
  const eraId = useEraId(era);
  return (
    <div className={`era-kpi ${className}`} data-era={eraId}>
      <div className="era-kpi-label">{label}</div>
      <div className="era-kpi-value">{value}</div>
    </div>
  );
}

export function EraBadge({
  era,
  children,
  className = '',
}: EraProp & { children: ReactNode; className?: string }) {
  const eraId = useEraId(era);
  return (
    <span className={`era-badge ${className}`} data-era={eraId}>
      {children}
    </span>
  );
}

export function EraSectionHeader({
  era,
  kicker,
  title,
  children,
  className = '',
}: EraProp & { kicker?: ReactNode; title: ReactNode; children?: ReactNode; className?: string }) {
  const eraId = useEraId(era);
  return (
    <header className={`era-section-header ${className}`} data-era={eraId}>
      {kicker && <div className="era-section-kicker">{kicker}</div>}
      <h1>{title}</h1>
      {children}
    </header>
  );
}
