import type { ReactNode } from "react";

/** Quiet, centered placeholder used for loading/empty/error across the app. */
function Placeholder({ tone, children }: { tone?: "error"; children: ReactNode }) {
  return (
    <div
      className={tone === "error" ? "state state--error" : "state"}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <Placeholder>
      <span className="spinner" aria-hidden="true" />
      {label}
    </Placeholder>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <Placeholder>{children}</Placeholder>;
}

export function ErrorState({ children }: { children: ReactNode }) {
  return <Placeholder tone="error">{children}</Placeholder>;
}
