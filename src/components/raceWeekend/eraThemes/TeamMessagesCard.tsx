type Props = {
  messages: string[];
  onOpenMessages: () => void;
};

export function TeamMessagesCard({ messages, onOpenMessages }: Props) {
  return (
    <section className="f1-1990s-panel min-h-[204px]" aria-label="Team messages">
      <header className="f1-1990s-panel-title">Team Messages</header>
      <ul className="space-y-2 text-xs text-neutral-300">
        {(messages.length > 0 ? messages : ['No urgent team messages.']).map((message, index) => (
          <li key={`${message}-${index}`} className="leading-snug">
            <span className="text-amber-400">-</span> {message}
          </li>
        ))}
      </ul>
      <button type="button" className="f1-1990s-secondary-button mt-3 w-full" onClick={onOpenMessages}>
        View All Messages
      </button>
    </section>
  );
}
