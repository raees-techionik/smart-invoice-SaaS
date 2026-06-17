import { redirect } from "next/navigation";

import { getCurrentSession, getPostLoginPath } from "@/app/_backend/lib/auth/session";

export default async function Home() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  redirect(getPostLoginPath(session.user.business.isProfileComplete));
}
