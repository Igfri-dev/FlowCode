"use client";

import Link from "next/link";
import { useActionState } from "react";
import { verifyEmailAction, type AuthFormState } from "@/app/actions/auth";
import { authButtonClassName } from "@/components/auth/AuthShell";

const initialState: AuthFormState = {};

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, initialState);

  return (
    <form action={action} className="mt-7 grid gap-4">
      <input type="hidden" name="token" value={token} />
      {!token ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          Falta el código de verificación. Solicita un enlace nuevo.
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.message}
        </p>
      ) : null}
      <button className={authButtonClassName} disabled={pending || !token}>
        {pending ? "Verificando..." : "Confirmar mi correo"}
      </button>
      <Link
        href="/resend-verification"
        className="text-center text-sm font-semibold text-emerald-700 hover:text-emerald-900"
      >
        Solicitar un enlace nuevo
      </Link>
      <Link
        href="/login"
        className="text-center text-sm font-semibold text-neutral-600 hover:text-neutral-900"
      >
        Volver al inicio de sesión
      </Link>
    </form>
  );
}
