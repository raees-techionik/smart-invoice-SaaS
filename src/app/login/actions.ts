"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/app/_backend/lib/auth/forms";
import { formValue, normalizeEmail } from "@/app/_backend/lib/auth/forms";
import { hashPassword, verifyPassword } from "@/app/_backend/lib/auth/password";
import { createSession, getPostLoginPath } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";

export async function registerOwner(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = formValue(formData, "name");
  const email = normalizeEmail(formValue(formData, "email"));
  const password = formValue(formData, "password");

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existingUsers = await prisma.user.count();

  if (existingUsers > 0) {
    return {
      error:
        "An owner account already exists for this local app. Please sign in instead.",
    };
  }

  const user = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: "Untitled business",
        ownerName: name,
        email,
      },
    });

    return tx.user.create({
      data: {
        businessId: business.id,
        name,
        email,
        password: hashPassword(password),
        role: "owner",
      },
      include: {
        business: true,
      },
    });
  });

  await createSession(user.id);
  redirect(getPostLoginPath(user.business.isProfileComplete));
}

export async function loginOwner(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = normalizeEmail(formValue(formData, "email"));
  const password = formValue(formData, "password");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      status: "active",
    },
    include: {
      business: true,
    },
  });

  if (!user || !verifyPassword(password, user.password)) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);
  redirect(getPostLoginPath(user.business.isProfileComplete));
}
