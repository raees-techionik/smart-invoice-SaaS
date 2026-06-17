"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  disabled?: boolean;
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  disabled = false,
  pendingLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-[34px] items-center justify-center rounded-lg bg-accent px-4 text-[12.5px] font-medium text-white transition hover:bg-[#2d7bc9] disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? pendingLabel ?? "Saving..." : children}
    </button>
  );
}
