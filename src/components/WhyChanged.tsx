import { useState } from 'react';
import type { MetricExplanation } from '../screens/explanationViewModel';

export function WhyChangedButton({
  explanation,
  label = 'Why?',
  className = '',
}: {
  explanation: MetricExplanation;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`ui-why-button ${className}`} onClick={() => setOpen(true)}>{label}</button>
      {open && <WhyChangedDialog explanation={explanation} onClose={() => setOpen(false)} />}
    </>
  );
}

export function WhyChangedDialog({ explanation, onClose }: { explanation: MetricExplanation; onClose: () => void }) {
  const delta = explanation.previousValue == null ? undefined : explanation.currentValue - explanation.previousValue;
  return (
    <div className="ui-why-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="ui-why-dialog" role="dialog" aria-modal="true" aria-labelledby={`why-${explanation.id}`}>
        <header>
          <div>
            <span>Why did this change?</span>
            <h2 id={`why-${explanation.id}`}>{explanation.label}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close explanation">×</button>
        </header>
        <div className="ui-why-value-strip">
          <div><span>Previous</span><strong>{explanation.previousValue == null ? 'Not recorded' : `${explanation.previousValue}${explanation.unit}`}</strong></div>
          <div><span>Current</span><strong>{explanation.currentValue}{explanation.unit}</strong></div>
          <div><span>Change</span><strong className={delta == null ? '' : delta > 0 ? 'is-positive' : delta < 0 ? 'is-negative' : ''}>{delta == null ? 'Unknown' : `${delta > 0 ? '+' : ''}${delta}${explanation.unit}`}</strong></div>
          <div><span>Evidence</span><strong>{explanation.confidence}</strong></div>
        </div>
        <p className="ui-why-summary">{explanation.summary}</p>
        <div className="ui-why-body">
          <section>
            <h3>Recent causes</h3>
            <div className="ui-why-causes">
              {explanation.causes.map((cause, index) => (
                <article key={`${cause.label}-${index}`} className={`is-${cause.tone}`}>
                  <div><strong>{cause.label}</strong>{cause.impact != null && <b>{cause.impact > 0 ? '+' : ''}{cause.impact}</b>}</div>
                  <p>{cause.detail}</p>
                  <small>{cause.source} · {cause.duration}</small>
                </article>
              ))}
            </div>
          </section>
          <aside>
            <section>
              <h3>Active modifiers</h3>
              {explanation.modifiers.length
                ? <ul>{explanation.modifiers.map((modifier) => <li key={modifier}>{modifier}</li>)}</ul>
                : <p>No additional active modifier is recorded.</p>}
            </section>
            <section>
              <h3>Downstream effects</h3>
              <ul>{explanation.downstreamEffects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
            </section>
            {explanation.previousValue == null && explanation.previousValueReason && (
              <section className="is-caution">
                <h3>Why no previous value?</h3>
                <p>{explanation.previousValueReason}</p>
              </section>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
