"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  registerIndependentAction,
  type AuthFormState,
} from "@/app/actions/auth";
import {
  authButtonClassName,
  authInputClassName,
} from "@/components/auth/AuthShell";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

const initialState: AuthFormState = {};

export function RegisterForm({ siteKey }: { siteKey: string }) {
  const [state, action, pending] = useActionState(
    registerIndependentAction,
    initialState,
  );

  if (state.complete) {
    return (
      <div className="mt-7 grid gap-4">
        <FormMessage state={state} />
        <Link
          href="/login"
          className={authButtonClassName + " text-center"}
        >
          Ir al inicio de sesión
        </Link>
        <Link
          href="/resend-verification"
          className="text-center text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          No recibí el correo
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-7 grid gap-4">
      <AuthField label="Nombre completo" name="fullName" autoComplete="name" />
      <AuthField label="Usuario" name="username" autoComplete="username" />
      <AuthField label="Correo electrónico" name="email" type="email" autoComplete="email" />
      <AuthField label="Contraseña" name="password" type="password" autoComplete="new-password" />
      <AuthField
        label="Confirmar contraseña"
        name="passwordConfirmation"
        type="password"
        autoComplete="new-password"
      />
      <p className="text-xs text-neutral-600">
        Mínimo 8 caracteres y al menos un número.
      </p>
      <TurnstileWidget resetKey={state.message ?? "initial"} siteKey={siteKey} />
      {state.message ? <FormMessage state={state} /> : null}
      <button className={authButtonClassName} disabled={pending}>
        {pending ? "Creando cuenta..." : "Crear mi cuenta"}
      </button>
      <Link href="/login" className="text-center text-sm font-semibold text-emerald-700 hover:text-emerald-900">
        Volver al inicio de sesión
      </Link>
      <Link href="/resend-verification" className="text-center text-sm font-semibold text-neutral-600 hover:text-neutral-900">
        Reenviar verificación
      </Link>
    </form>
  );
}

function AuthField({
  autoComplete,
  label,
  name,
  type = "text",
}: {
  autoComplete: string;
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <label className="text-sm font-semibold text-neutral-800">
      {label}
      <input
        className={authInputClassName}
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={type === "password" ? 8 : undefined}
        required
      />
    </label>
  );
}

function FormMessage({ state }: { state: AuthFormState }) {
  const styles =
    state.status === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : state.status === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-red-300 bg-red-50 text-red-900";

  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {state.message}
    </p>
  );
}
