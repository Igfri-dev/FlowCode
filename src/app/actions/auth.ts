"use server";

import { redirect } from "next/navigation";
import { authenticateUser, createSession, destroySession } from "@/lib/auth";

export type LoginState = {
  message?: string;
};

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { message: "Enter your username and password." };
  }

  const user = await authenticateUser(username, password);

  if (!user) {
    return { message: "Invalid username or password." };
  }

  await createSession(user.id);
  redirect(user.role === "admin" || user.role === "teacher" ? "/admin" : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
