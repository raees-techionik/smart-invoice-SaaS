"use client";

export function PrintButton() {
  return (
    <button
      className="premium-soft-button inline-flex h-[34px] items-center justify-center rounded-lg border px-3 text-[11.5px] font-medium transition hover:border-[#635bff]/30 hover:bg-white"
      onClick={() => window.print()}
      type="button"
    >
      Print invoice
    </button>
  );
}
