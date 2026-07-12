import { useId, useState, type FormEvent } from "react";
import { createAccount } from "../api/client.ts";
import { getDisplayMessage } from "../lib/errors.ts";
import { Input } from "./ui/Input.tsx";
import { Button } from "./ui/Button.tsx";
import type { Account, AccountType } from "../types.ts";

const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];

interface CreateAccountFormProps {
  onCreated: (account: Account) => void;
}

export function CreateAccountForm({ onCreated }: CreateAccountFormProps) {
  const typeId = useId();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("asset");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Account name is required");
      return;
    }

    setSubmitting(true);
    try {
      const account = await createAccount({ name: name.trim(), type });
      setName("");
      setType("asset");
      onCreated(account);
    } catch (err) {
      setError(getDisplayMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="account-form__row">
        <Input
          label="Account name"
          placeholder="e.g. Cash"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="field">
          <label className="field__label" htmlFor={typeId}>
            Type
          </label>
          <select
            id={typeId}
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "+ Add account"}
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
