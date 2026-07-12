import type { ReactNode } from "react";

interface CardProps {
  /** Optional header title; when omitted the card is a plain bordered surface. */
  title?: ReactNode;
  /** Optional right-aligned header slot (actions, a badge, a hint). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A calm bordered surface — the primary container for every data view. */
export function Card({ title, action, children, className }: CardProps) {
  return (
    <section className={["card", className].filter(Boolean).join(" ")}>
      {(title || action) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {action && <div className="card__action">{action}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  );
}
