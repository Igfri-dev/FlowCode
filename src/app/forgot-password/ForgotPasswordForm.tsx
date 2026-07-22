"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  forgotPasswordAction,
  type AuthFormState,
} from "@/app/actions/auth";
import {
  authButtonClassName,
  authInputClassName,
} from "@/components/auth/AuthShell";

const initialState: AuthFormState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  return (
    <form action={action} className="mt-7 grid gap-4">
      <label className="text-sm font-semibold text-neutral-800">
        Correo electrónico
        <input className={authInputClassName} name="email" type="email" autoComplete="email" required />
      </label>
      {state.message ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-900">{state.message}</p>
      ) : null}
      <button className={authButtonClassName} disabled={pending}>
        {pending ? "Enviando..." : "Enviar enlace"}
      </button>
      <Link href="/login" className="text-center text-sm font-semibold text-emerald-700 hover:text-emerald-900">Volver al inicio de sesión</Link>
    </form>
  );
}

