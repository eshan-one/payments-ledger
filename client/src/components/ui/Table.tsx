import type { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
}

/** Wraps tables in an overflow container so wide tables scroll, not the page. */
export function Table({ children, className }: TableProps) {
  return (
    <div className="table-wrap">
      <table className={["table", className].filter(Boolean).join(" ")}>{children}</table>
    </div>
  );
}
