import type { Account } from "../types.ts";
import { formatCents } from "../lib/money.ts";
import { Table } from "./ui/Table.tsx";
import { EmptyState } from "./ui/States.tsx";

interface AccountBalanceRow {
  account: Account;
  balanceCents: number;
}

interface AccountsListProps {
  rows: AccountBalanceRow[];
}

export function AccountsList({ rows }: AccountsListProps) {
  if (rows.length === 0) {
    return <EmptyState>No accounts yet.</EmptyState>;
  }

  return (
    <Table>
      <thead>
        <tr>
          <th>Account</th>
          <th>Type</th>
          <th>Currency</th>
          <th className="amount">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ account, balanceCents }) => (
          <tr key={account._id}>
            <td>{account.name}</td>
            <td style={{ textTransform: "capitalize" }}>{account.type}</td>
            <td>{account.currency}</td>
            <td
              className={
                "amount" +
                (balanceCents > 0 ? " pos" : balanceCents < 0 ? " neg" : "")
              }
            >
              {formatCents(balanceCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export type { AccountBalanceRow };
