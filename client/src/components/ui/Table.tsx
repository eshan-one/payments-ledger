import type { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
}

/**
 * Thin wrapper that gives every table a consistent look and — critically —
 * keeps wide, number-heavy tables from forcing the page to scroll sideways by
 * letting the table itself scroll inside an overflow container.
 */
export function Table({ children, className }: TableProps) {
  return (
    <div className="table-wrap">
      <table className={["table", className].filter(Boolean).join(" ")}>{children}</table>
    </div>
  );
}
