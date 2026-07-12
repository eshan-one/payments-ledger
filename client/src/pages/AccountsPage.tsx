import { useEffect, useState } from "react";
import { getAccountBalance, listAccounts } from "../api/client.ts";
import { AccountsList, type AccountBalanceRow } from "../components/AccountsList.tsx";
import { Card } from "../components/ui/Card.tsx";
import { Loading, ErrorState } from "../components/ui/States.tsx";
import type { AccountType } from "../types.ts";
import { formatCents } from "../lib/money.ts";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: AccountBalanceRow[] };

const TYPE_LABELS: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

/** Sum balances per account type so each summary card totals real numbers. */
function summarize(rows: AccountBalanceRow[]): { type: AccountType; totalCents: number }[] {
  const totals = new Map<AccountType, number>();
  for (const { account, balanceCents } of rows) {
    totals.set(account.type, (totals.get(account.type) ?? 0) + balanceCents);
  }
  return [...totals.entries()].map(([type, totalCents]) => ({ type, totalCents }));
}

export function AccountsPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: "loading" });
      try {
        const accounts = await listAccounts();
        const balances = await Promise.all(
          accounts.map((account) => getAccountBalance(account._id)),
        );
        if (cancelled) return;

        const rows: AccountBalanceRow[] = accounts.map((account, i) => ({
          account,
          balanceCents: balances[i].balanceCents,
        }));
        setState({ status: "ready", rows });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load accounts",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = state.status === "ready" ? summarize(state.rows) : [];

  return (
    <>
      <header className="page__head">
        <div>
          <h1 className="page__title">Accounts</h1>
          <p className="page__subtitle">Balances derived live from the ledger.</p>
        </div>
      </header>

      {state.status === "ready" && summary.length > 0 && (
        <div className="summary-grid">
          {summary.map(({ type, totalCents }) => (
            <div className="stat" key={type}>
              <p className="stat__label">{TYPE_LABELS[type]}</p>
              <p
                className={
                  "stat__value num" +
                  (totalCents > 0 ? " pos" : totalCents < 0 ? " neg" : "")
                }
              >
                {formatCents(totalCents)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Card title="All accounts">
        {state.status === "loading" && <Loading label="Loading accounts…" />}
        {state.status === "error" && <ErrorState>{state.message}</ErrorState>}
        {state.status === "ready" && <AccountsList rows={state.rows} />}
      </Card>
    </>
  );
}
