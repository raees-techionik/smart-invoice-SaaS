"use client";

export function PrintButton() {
  return (
    <button
      className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border bg-white px-3 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
      onClick={() => window.print()}
      type="button"
    >
      Print invoice
    </button>
  );
}
