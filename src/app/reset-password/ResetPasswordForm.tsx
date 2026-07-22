"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  resetPasswordAction,
  type AuthFormState,
} from "@/app/actions/auth";
import {
  authButtonClassName,
  authInputClassName,
} from "@/components/auth/AuthShell";

const initialState: AuthFormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  return (
    <form action={action} className="mt-7 grid gap-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField label="Contraseña nueva" name="password" />
      <PasswordField label="Confirmar contraseña" name="passwordConfirmation" />
      <p className="text-xs text-neutral-600">Mínimo 8 caracteres y al menos un número.</p>
      {state.message ? <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.message}</p> : null}
      <button className={authButtonClassName} disabled={pending || !token}>
        {pending ? "Guardando..." : "Guardar contraseña"}
      </button>
      <Link href="/login" className="text-center text-sm font-semibold text-emerald-700 hover:text-emerald-900">Volver al inicio de sesión</Link>
    </form>
  );
}

function PasswordField({ label, name }: { label: string; name: string }) {
  return (
    <label className="text-sm font-semibold text-neutral-800">
      {label}
      <input className={authInputClassName} name={name} type="password" minLength={8} autoComplete="new-password" required />
    </label>
  );
}

