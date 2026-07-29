import type { ReactNode } from 'react';
import {
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from './FmPane';

export type CoreWorkspaceItem<T extends string> = {
  id: T;
  label: string;
  description?: string;
  status?: ReactNode;
  urgent?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export function CoreWorkspaceFrame<T extends string>({
  items,
  active,
  onChange,
  ariaLabel,
  listTitle = 'Workspace',
  listMeta,
  detailTitle,
  detailMeta,
  contextTitle = 'Context & next step',
  contextMeta,
  context,
  children,
  className = '',
}: {
  items: ReadonlyArray<CoreWorkspaceItem<T>>;
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  listTitle?: ReactNode;
  listMeta?: ReactNode;
  detailTitle?: ReactNode;
  detailMeta?: ReactNode;
  contextTitle?: ReactNode;
  contextMeta?: ReactNode;
  context: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const selected = items.find((item) => item.id === active) ?? items[0];

  return (
    <FmWorkspaceGrid columns="three" className={`ui-core-workspace-grid ${className}`}>
      <FmPane ariaLabel={ariaLabel}>
        <FmPaneHeader title={listTitle} meta={listMeta ?? `${items.length} sections`} />
        <FmPaneBody>
          {items.map((item) => (
            <FmListButton
              key={item.id}
              active={item.id === active}
              urgent={item.urgent}
              className={item.disabled ? 'is-disabled' : ''}
              onClick={item.disabled ? undefined : () => onChange(item.id)}
            >
              <span className="ui-news-list-source">{item.status ?? 'Management area'}</span>
              <strong>{item.label}</strong>
              {item.description && <span>{item.description}</span>}
              <small>{item.disabled ? item.disabledReason ?? 'Unavailable' : item.id === active ? 'Selected' : 'Open →'}</small>
            </FmListButton>
          ))}
        </FmPaneBody>
      </FmPane>

      <FmPane className="ui-core-workspace-detail">
        <FmPaneHeader
          title={detailTitle ?? selected?.label ?? 'Detail'}
          meta={detailMeta ?? selected?.description}
        />
        <FmPaneBody className="ui-core-workspace-detail-body">
          {children}
        </FmPaneBody>
      </FmPane>

      <FmPane className="ui-core-workspace-context">
        <FmPaneHeader title={contextTitle} meta={contextMeta} />
        <FmPaneBody className="ui-core-workspace-context-body">
          {context}
        </FmPaneBody>
      </FmPane>
    </FmWorkspaceGrid>
  );
}

export function CoreWorkspaceSection({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ui-core-workspace-section ${className}`}>
      {(title || actions) && (
        <header className="ui-core-workspace-section-header">
          {title && <h2>{title}</h2>}
          {actions && <div className="ui-core-workspace-section-actions">{actions}</div>}
        </header>
      )}
      <div className="ui-core-workspace-section-body">{children}</div>
    </section>
  );
}

export function CoreWorkspaceContextGroup({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ui-core-workspace-context-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
