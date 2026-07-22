"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type AuthFormState,
} from "@/app/actions/auth";
import {
  authButtonClassName,
  authInputClassName,
} from "@/components/auth/AuthShell";

const initialState: AuthFormState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <form action={action} className="mt-7 grid gap-4">
      <PasswordField label="Contraseña actual" name="currentPassword" autoComplete="current-password" />
      <PasswordField label="Contraseña nueva" name="newPassword" autoComplete="new-password" />
      <PasswordField label="Confirmar contraseña nueva" name="passwordConfirmation" autoComplete="new-password" />
      <p className="text-xs text-neutral-600">Debe tener al menos 8 caracteres y un número.</p>
      {state.message ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.message}</p>
      ) : null}
      <button className={authButtonClassName} disabled={pending}>
        {pending ? "Guardando..." : "Cambiar contraseña y continuar"}
      </button>
    </form>
  );
}

function PasswordField({ label, name, autoComplete }: { label: string; name: string; autoComplete: string }) {
  return (
    <label className="text-sm font-semibold text-neutral-800">
      {label}
      <input className={authInputClassName} name={name} type="password" minLength={8} autoComplete={autoComplete} required />
    </label>
  );
}

