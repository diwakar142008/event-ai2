import { redirect } from "next/navigation";

import { serverApi, ServerApiError } from "@/lib/server";
import type { User } from "@/lib/types";

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await serverApi<User>("/api/auth/me");
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) return null;
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
