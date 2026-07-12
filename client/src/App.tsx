import { useState } from "react";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { AccountsPage } from "./pages/AccountsPage.tsx";
import { InvoicesPage } from "./pages/InvoicesPage.tsx";
import { CreateInvoicePage } from "./pages/CreateInvoicePage.tsx";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage.tsx";
import { Button } from "./components/ui/Button.tsx";
import { DashboardIcon, AccountsIcon, InvoicesIcon, NewIcon } from "./components/icons.tsx";

type View =
  | { name: "dashboard" }
  | { name: "accounts" }
  | { name: "invoices" }
  | { name: "create-invoice" }
  | { name: "invoice-detail"; invoiceId: string };

const TITLES: Record<View["name"], [string, string]> = {
  dashboard: ["Dashboard", "Balances, activity and outstanding at a glance"],
  accounts: ["Accounts", "Balances derived live from the ledger"],
  invoices: ["Invoices", "Every invoice, filterable by status"],
  "create-invoice": ["New invoice", "The total is computed server-side from the line items"],
  "invoice-detail": ["Invoice", "Review line items, payments and remaining balance"],
};

const NAV_ITEMS: { view: View; label: string; icon: () => React.JSX.Element }[] = [
  { view: { name: "dashboard" }, label: "Dashboard", icon: DashboardIcon },
  { view: { name: "accounts" }, label: "Accounts", icon: AccountsIcon },
  { view: { name: "invoices" }, label: "Invoices", icon: InvoicesIcon },
  { view: { name: "create-invoice" }, label: "New invoice", icon: NewIcon },
];

function App() {
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [invoiceLookup, setInvoiceLookup] = useState("");

  function viewInvoice(invoiceId: string) {
    setView({ name: "invoice-detail", invoiceId });
  }

  const [title, subtitle] = TITLES[view.name];
  const isInvoicesSection = view.name === "invoices" || view.name === "invoice-detail";

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden="true" />
          <span>Ledger</span>
        </div>

        <nav className="sidebar__nav">
          <span className="sidebar__cap">Menu</span>
          {NAV_ITEMS.map(({ view: itemView, label, icon: Icon }) => {
            const active =
              view.name === itemView.name ||
              (itemView.name === "invoices" && isInvoicesSection);
            return (
              <button
                key={label}
                type="button"
                className={"navlink" + (active ? " active" : "")}
                aria-current={active ? "page" : undefined}
                onClick={() => setView(itemView)}
              >
                <span className="navlink__icon">
                  <Icon />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="page__title">{title}</h1>
            <p className="page__subtitle">{subtitle}</p>
          </div>
          <div className="topbar__right">
            <form
              className="lookup"
              onSubmit={(e) => {
                e.preventDefault();
                if (invoiceLookup.trim()) viewInvoice(invoiceLookup.trim());
              }}
            >
              <input
                type="text"
                className="input"
                aria-label="Look up invoice by ID"
                placeholder="Find invoice ID…"
                value={invoiceLookup}
                onChange={(e) => setInvoiceLookup(e.target.value)}
              />
              <Button type="submit" variant="secondary" size="sm">
                Find
              </Button>
            </form>
            <Button onClick={() => setView({ name: "create-invoice" })}>
              + New invoice
            </Button>
          </div>
        </header>

        <div className="page">
          {view.name === "dashboard" && (
            <DashboardPage
              onSelectInvoice={viewInvoice}
              onCreateInvoice={() => setView({ name: "create-invoice" })}
              onViewAllInvoices={() => setView({ name: "invoices" })}
            />
          )}
          {view.name === "accounts" && <AccountsPage />}
          {view.name === "invoices" && (
            <InvoicesPage
              onSelectInvoice={viewInvoice}
              onCreateInvoice={() => setView({ name: "create-invoice" })}
            />
          )}
          {view.name === "create-invoice" && (
            <CreateInvoicePage onCreated={viewInvoice} />
          )}
          {view.name === "invoice-detail" && (
            <InvoiceDetailPage
              invoiceId={view.invoiceId}
              onBack={() => setView({ name: "invoices" })}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
