import { useState } from "react";
import { AccountsPage } from "./pages/AccountsPage.tsx";
import { CreateInvoicePage } from "./pages/CreateInvoicePage.tsx";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage.tsx";
import { Button } from "./components/ui/Button.tsx";

type View =
  | { name: "accounts" }
  | { name: "create-invoice" }
  | { name: "invoice-detail"; invoiceId: string };

function App() {
  const [view, setView] = useState<View>({ name: "accounts" });
  const [invoiceLookup, setInvoiceLookup] = useState("");

  function viewInvoice(invoiceId: string) {
    setView({ name: "invoice-detail", invoiceId });
  }

  return (
    <div className="app">
      <nav className="topnav" aria-label="Primary">
        <div className="topnav__brand">
          <span className="topnav__mark" aria-hidden="true" />
          Ledger
        </div>

        <div className="topnav__links">
          <button
            type="button"
            className={`navlink${view.name === "accounts" ? " active" : ""}`}
            aria-current={view.name === "accounts" ? "page" : undefined}
            onClick={() => setView({ name: "accounts" })}
          >
            Accounts
          </button>
          <button
            type="button"
            className={`navlink${view.name === "create-invoice" ? " active" : ""}`}
            aria-current={view.name === "create-invoice" ? "page" : undefined}
            onClick={() => setView({ name: "create-invoice" })}
          >
            New Invoice
          </button>
        </div>

        <form
          className="lookup topnav__spacer"
          onSubmit={(e) => {
            e.preventDefault();
            if (invoiceLookup.trim()) viewInvoice(invoiceLookup.trim());
          }}
        >
          <input
            type="text"
            className="input"
            aria-label="Look up invoice by ID"
            placeholder="Invoice ID…"
            value={invoiceLookup}
            onChange={(e) => setInvoiceLookup(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="sm">
            View
          </Button>
        </form>
      </nav>

      <main className="page">
        {view.name === "accounts" && <AccountsPage />}
        {view.name === "create-invoice" && (
          <CreateInvoicePage onCreated={viewInvoice} />
        )}
        {view.name === "invoice-detail" && (
          <InvoiceDetailPage invoiceId={view.invoiceId} />
        )}
      </main>
    </div>
  );
}

export default App;
