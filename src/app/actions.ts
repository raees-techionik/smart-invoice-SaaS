"use server";

import { redirect } from "next/navigation";

import { destroySession } from "@/app/_backend/lib/auth/session";

export async function logout() {
  await destroySession();
  redirect("/login");
}
