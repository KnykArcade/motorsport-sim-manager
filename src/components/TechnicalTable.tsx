import type { CSSProperties, ReactNode } from 'react';

export function TechnicalTable({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-neutral-800 ${className}`}>
      <table className="w-full min-w-[760px] text-xs">
        {children}
      </table>
    </div>
  );
}

export function TechnicalTableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-neutral-900/60 text-left uppercase tracking-wide text-neutral-500">{children}</thead>;
}

export function TechnicalTableRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={`border-t border-neutral-800/70 hover:bg-neutral-900/40 ${className}`}>{children}</tr>;
}

export function TechnicalTableCell({
  children,
  className = '',
  header = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  header?: boolean;
  style?: CSSProperties;
}) {
  const Component = header ? 'th' : 'td';
  return <Component style={style} className={`px-3 py-2 align-middle ${header ? 'font-medium' : ''} ${className}`}>{children}</Component>;
}
