export type AppIconName =
  | "box"
  | "chart"
  | "credit-card"
  | "dashboard"
  | "download"
  | "expense"
  | "file"
  | "gear"
  | "invoice"
  | "plus"
  | "pos"
  | "profit"
  | "refund"
  | "scan"
  | "search"
  | "stock"
  | "template"
  | "user"
  | "users";

const iconPaths: Record<AppIconName, string[]> = {
  box: [
    "M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z",
    "M4 7.5v9L12 21l8-4.5v-9",
    "M12 12v9",
  ],
  chart: [
    "M4 19V5",
    "M4 19h16",
    "M8 15l3-4 3 2 4-7",
  ],
  "credit-card": [
    "M4 7.5h16v10H4v-10Z",
    "M4 10.5h16",
    "M8 15h3",
  ],
  dashboard: [
    "M4 4h7v7H4V4Z",
    "M13 4h7v5h-7V4Z",
    "M4 13h7v7H4v-7Z",
    "M13 11h7v9h-7v-9Z",
  ],
  download: [
    "M12 3v11",
    "m8 10 4 4 4-4",
    "M5 20h14",
  ],
  expense: [
    "M6 3h12v18l-3-2-3 2-3-2-3 2V3Z",
    "M9 8h6",
    "M9 12h6",
    "M9 16h3",
  ],
  file: [
    "M7 3h7l4 4v14H7V3Z",
    "M14 3v5h5",
    "M9.5 12h5",
    "M9.5 16h5",
  ],
  gear: [
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
    "M19 13.2v-2.4l-2.1-.6-.7-1.7 1-1.9-1.8-1.8-1.9 1-1.7-.7L11.2 2H8.8l-.6 2.1-1.7.7-1.9-1-1.8 1.8 1 1.9-.7 1.7-2.1.6v2.4l2.1.6.7 1.7-1 1.9 1.8 1.8 1.9-1 1.7.7.6 2.1h2.4l.6-2.1 1.7-.7 1.9 1 1.8-1.8-1-1.9.7-1.7 2.1-.6Z",
  ],
  invoice: [
    "M6 3h12v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 21V3Z",
    "M9 8h6",
    "M9 12h6",
    "M9 16h4",
  ],
  plus: [
    "M12 5v14",
    "M5 12h14",
  ],
  pos: [
    "M5 4h14v9H5V4Z",
    "M8 17h8",
    "M7 21h10",
    "M9 13v4",
    "M15 13v4",
  ],
  profit: [
    "M5 17l5-5 3 3 6-8",
    "M15 7h4v4",
    "M5 21h14",
  ],
  refund: [
    "M7 7h8a4 4 0 0 1 0 8H6",
    "m9 3-3 3 3 3",
    "M9 11H5V7",
  ],
  scan: [
    "M4 8V5a1 1 0 0 1 1-1h3",
    "M16 4h3a1 1 0 0 1 1 1v3",
    "M20 16v3a1 1 0 0 1-1 1h-3",
    "M8 20H5a1 1 0 0 1-1-1v-3",
    "M7 12h10",
    "M9 9h6",
    "M9 15h6",
  ],
  search: [
    "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
    "m16 16 4 4",
  ],
  stock: [
    "M4 19h16",
    "M6 19V9h3v10",
    "M11 19V5h3v14",
    "M16 19v-7h3v7",
  ],
  template: [
    "M5 4h14v16H5V4Z",
    "M8 8h8",
    "M8 12h8",
    "M8 16h5",
  ],
  user: [
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M4.5 21a7.5 7.5 0 0 1 15 0",
  ],
  users: [
    "M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M3.5 20a6 6 0 0 1 12 0",
    "M16 11a3 3 0 1 0-1.2-5.75",
    "M17 20h3.5a5.5 5.5 0 0 0-5.2-5.5",
  ],
};

export function AppIcon({
  className,
  name,
}: {
  className?: string;
  name: AppIconName;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {iconPaths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}

export function metricIconForLabel(label: string): AppIconName {
  const value = label.toLowerCase();

  if (value.includes("customer")) {
    return "users";
  }

  if (
    value.includes("product") ||
    value.includes("catalog") ||
    value.includes("item")
  ) {
    return "box";
  }

  if (
    value.includes("stock") ||
    value.includes("unit") ||
    value.includes("valuation")
  ) {
    return "stock";
  }

  if (value.includes("payment") || value.includes("collected")) {
    return "credit-card";
  }

  if (
    value.includes("balance") ||
    value.includes("receivable") ||
    value.includes("due")
  ) {
    return "credit-card";
  }

  if (value.includes("refund")) {
    return "refund";
  }

  if (value.includes("expense") || value.includes("cost")) {
    return "expense";
  }

  if (
    value.includes("profit") ||
    value.includes("revenue") ||
    value.includes("sales") ||
    value.includes("margin")
  ) {
    return "profit";
  }

  if (value.includes("invoice") || value.includes("bill")) {
    return "invoice";
  }

  if (
    value.includes("import") ||
    value.includes("job") ||
    value.includes("review") ||
    value.includes("document")
  ) {
    return "scan";
  }

  if (value.includes("template")) {
    return "template";
  }

  if (value.includes("export") || value.includes("backup")) {
    return "download";
  }

  if (value.includes("pos") || value.includes("cash")) {
    return "pos";
  }

  if (value.includes("active") || value.includes("record")) {
    return "file";
  }

  if (value.includes("category") || value.includes("trend")) {
    return "chart";
  }

  return "chart";
}
