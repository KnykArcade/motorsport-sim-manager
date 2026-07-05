import type { WeekendScheduleItem } from './types';

type Props = {
  items: WeekendScheduleItem[];
  onOpenItem?: (item: WeekendScheduleItem) => void;
};

const STATUS_LABEL: Record<WeekendScheduleItem['status'], string> = {
  completed: 'OK',
  current: 'NOW',
  upcoming: '--',
  locked: 'LOCK',
};

export function RaceWeekendScheduleCard({ items, onOpenItem }: Props) {
  const groups = ['Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

  return (
    <section className="f1-1990s-panel" aria-label="Race weekend schedule">
      <header className="f1-1990s-panel-title">Race Weekend Schedule</header>
      <div className="space-y-3">
        {groups.map((day) => {
          const dayItems = items.filter((item) => item.day === day);
          if (dayItems.length === 0) return null;
          return (
            <div key={day}>
              <div className="mb-1 text-[11px] font-bold uppercase text-lime-400">{day}</div>
              <div className="space-y-1">
                {dayItems.map((item) => {
                  const clickable = !!item.action && item.status !== 'locked' && !!onOpenItem;
                  const className = `grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 rounded border px-2 py-1.5 text-left text-sm transition ${
                      item.status === 'current'
                        ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                        : item.status === 'completed'
                        ? 'border-lime-500/20 bg-lime-500/5 text-neutral-200'
                        : item.status === 'locked'
                        ? 'border-neutral-800 bg-neutral-950/40 text-neutral-500'
                        : 'border-transparent text-neutral-300'
                    } ${clickable ? 'hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300' : ''}`;
                  const content = (
                    <>
                      <span>{item.label}</span>
                      <span className="font-mono text-xs text-neutral-300">{item.time}</span>
                      <span className="w-9 text-right font-mono text-[10px] text-neutral-500">
                        {STATUS_LABEL[item.status]}
                      </span>
                    </>
                  );

                  return clickable ? (
                    <button key={item.id} type="button" className={className} title={item.lockedReason} onClick={() => onOpenItem(item)}>
                      {content}
                    </button>
                  ) : (
                    <div key={item.id} className={className} title={item.lockedReason}>
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
