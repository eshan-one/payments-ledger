import { useEffect, useState } from "react";
import { createAccount, getAccountBalance, listAccounts } from "../api/client.ts";
import { AccountsList, type AccountBalanceRow } from "../components/AccountsList.tsx";
import { CreateAccountForm } from "../components/CreateAccountForm.tsx";
import { Card } from "../components/ui/Card.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Loading, ErrorState } from "../components/ui/States.tsx";
import type { AccountType } from "../types.ts";
import { formatCents } from "../lib/money.ts";
import { getDisplayMessage } from "../lib/errors.ts";

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

// invoiceService looks these up by exact name when posting a payment (see
// server/src/services/invoiceService.js) — without both, "Apply payment"
// fails with a 404. Surface a one-click way to create them instead of
// making someone curl POST /api/accounts by hand.
const REQUIRED_ACCOUNTS: { name: string; type: AccountType }[] = [
  { name: "Cash", type: "asset" },
  { name: "Accounts Receivable", type: "asset" },
];

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
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  async function load() {
    setState({ status: "loading" });
    try {
      const accounts = await listAccounts();
      const balances = await Promise.all(
        accounts.map((account) => getAccountBalance(account._id)),
      );
      const rows: AccountBalanceRow[] = accounts.map((account, i) => ({
        account,
        balanceCents: balances[i].balanceCents,
      }));
      setState({ status: "ready", rows });
    } catch (err) {
      setState({ status: "error", message: getDisplayMessage(err) });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = state.status === "ready" ? summarize(state.rows) : [];
  const missingRequired =
    state.status === "ready"
      ? REQUIRED_ACCOUNTS.filter(
          (req) => !state.rows.some((row) => row.account.name === req.name),
        )
      : [];

  async function handleQuickSetup() {
    setSettingUp(true);
    setSetupError(null);
    try {
      await Promise.all(missingRequired.map((account) => createAccount(account)));
      await load();
    } catch (err) {
      setSetupError(getDisplayMessage(err));
    } finally {
      setSettingUp(false);
    }
  }

  return (
    <>
      {state.status === "ready" && missingRequired.length > 0 && (
        <Card title="Required accounts">
          <p style={{ margin: "0 0 var(--space-4)", color: "var(--text-muted)", fontSize: "14px" }}>
            Payments post against <strong>Cash</strong> and <strong>Accounts Receivable</strong> by
            name — create them once before applying a payment to an invoice.
          </p>
          <Button onClick={handleQuickSetup} disabled={settingUp}>
            {settingUp
              ? "Setting up…"
              : `+ Create ${missingRequired.map((a) => a.name).join(" & ")}`}
          </Button>
          {setupError && (
            <p className="form-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
              {setupError}
            </p>
          )}
        </Card>
      )}

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

      {state.status === "ready" && (
        <Card title="Add account" action={<span className="card__meta">Balances start at $0.00</span>}>
          <CreateAccountForm onCreated={() => void load()} />
        </Card>
      )}
    </>
  );
}
