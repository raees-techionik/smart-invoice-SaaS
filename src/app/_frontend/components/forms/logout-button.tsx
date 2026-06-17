import { logout } from "@/app/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        className="rounded-lg border border-border px-3 py-2 text-[11.5px] font-medium transition hover:bg-[#e6f1fb]"
        type="submit"
      >
        Sign out
      </button>
    </form>
  );
}
