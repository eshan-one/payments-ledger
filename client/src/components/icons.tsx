// Nav icons use stroke="currentColor" to pick up the active/inactive text color.
const common = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function DashboardIcon() {
  return (
    <svg {...common}>
      <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="10" y="2.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="2.5" y="10" width="5.5" height="5.5" rx="1.2" />
      <rect x="10" y="10" width="5.5" height="5.5" rx="1.2" />
    </svg>
  );
}

export function AccountsIcon() {
  return (
    <svg {...common}>
      <path d="M2.5 5.5 L9 2.5 L15.5 5.5" />
      <path d="M3.5 5.5 v7" />
      <path d="M14.5 5.5 v7" />
      <path d="M7 5.5 v7" />
      <path d="M11 5.5 v7" />
      <path d="M2.5 15.5 h13" />
    </svg>
  );
}

export function InvoicesIcon() {
  return (
    <svg {...common}>
      <path d="M4 2.5 h7 l3 3 v10 h-10 z" />
      <path d="M11 2.5 v3 h3" />
      <path d="M6 9 h6" />
      <path d="M6 12 h6" />
    </svg>
  );
}

export function NewIcon() {
  return (
    <svg {...common}>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 6 v6 M6 9 h6" />
    </svg>
  );
}
