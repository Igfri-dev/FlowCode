"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import {
  authButtonClassName,
  authInputClassName,
} from "@/components/auth/AuthShell";

const initialState: LoginState = {};

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="mt-7 flex flex-col gap-5">
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"
        >
          {notice}
        </p>
      ) : null}
      <div>
        <label
          className="text-sm font-semibold text-slate-700"
          htmlFor="username"
        >
          Usuario
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          className={authInputClassName}
          required
        />
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-700"
          htmlFor="password"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={authInputClassName}
          required
        />
      </div>

      {state.message ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900"
        >
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={authButtonClassName}>
        {pending ? "Entrando..." : "Iniciar sesión"}
      </button>
      <div className="flex flex-col items-center justify-between gap-3 text-xs sm:flex-row">
        <Link
          href="/forgot-password"
          className="font-semibold text-emerald-700 hover:text-emerald-900"
        >
          Olvidé mi contraseña
        </Link>
        <Link
          href="/register"
          className="font-semibold text-emerald-700 hover:text-emerald-900"
        >
          Crear cuenta personal
        </Link>
      </div>
      <Link
        href="/resend-verification"
        className="border-t border-slate-100 pt-4 text-center text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        Reenviar correo de verificación
      </Link>
    </form>
  );
}
