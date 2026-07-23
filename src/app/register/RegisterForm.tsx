"use client";

import Link from "next/link";
import {
  useActionState,
  useState,
  type ChangeEventHandler,
  type FocusEventHandler,
} from "react";
import {
  checkEmailAvailabilityAction,
  checkUsernameAvailabilityAction,
  registerIndependentAction,
  type AuthFormState,
} from "@/app/actions/auth";
import {
  authButtonClassName,
  authInputClassName,
} from "@/components/auth/AuthShell";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { useAccountAvailability } from "@/hooks/useAccountAvailability";
import { getPasswordPolicyError, isValidEmail } from "@/lib/password-policy";
import { getUsernamePolicyError } from "@/lib/username-policy";

const initialState: AuthFormState = {};

export function RegisterForm({ siteKey }: { siteKey: string }) {
  const [state, action, pending] = useActionState(
    registerIndependentAction,
    initialState,
  );
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const normalizedUsername = username.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const usernameError = normalizedUsername
    ? getUsernamePolicyError(normalizedUsername)
    : null;
  const emailError =
    normalizedEmail && !isValidEmail(normalizedEmail)
      ? "Introduce un correo electrónico válido."
      : null;
  const passwordError = password ? getPasswordPolicyError(password) : null;
  const passwordsMatch =
    Boolean(passwordConfirmation) && password === passwordConfirmation;
  const usernameCheck = useAccountAvailability({
    canCheck: Boolean(normalizedUsername) && !usernameError,
    check: checkUsernameAvailabilityAction,
    failureMessage: "No se pudo comprobar el nombre de usuario.",
    value: normalizedUsername,
  });
  const emailCheck = useAccountAvailability({
    canCheck: Boolean(normalizedEmail) && !emailError,
    check: checkEmailAvailabilityAction,
    failureMessage: "No se pudo comprobar el correo electrónico.",
    value: normalizedEmail,
  });

  const usernameStatus = getAvailabilityStatus({
    availability: usernameCheck.availability,
    checking: usernameCheck.pending,
    emptyMessage: "Elige un nombre de usuario.",
    localError: usernameError,
  });
  const emailStatus = getAvailabilityStatus({
    availability: emailCheck.availability,
    checking: emailCheck.pending,
    emptyMessage: "Usa un correo al que tengas acceso.",
    localError: emailError,
  });
  const passwordStatus: FieldStatus = !password
    ? {
        message: "Mínimo 8 caracteres y al menos un número.",
        tone: "neutral",
      }
    : passwordError
      ? { message: passwordError, tone: "error" }
      : { message: "La contraseña cumple los requisitos.", tone: "success" };
  const confirmationStatus: FieldStatus = !passwordConfirmation
    ? { message: "Repite la contraseña.", tone: "neutral" }
    : passwordsMatch
      ? { message: "Las contraseñas coinciden.", tone: "success" }
      : { message: "Las contraseñas no coinciden.", tone: "error" };
  const usernameReady =
    Boolean(normalizedUsername) &&
    !usernameError &&
    usernameCheck.availability?.available;
  const emailReady =
    Boolean(normalizedEmail) &&
    !emailError &&
    emailCheck.availability?.available;

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
      <AuthField
        label="Usuario"
        name="username"
        autoComplete="username"
        maxLength={80}
        onBlur={usernameCheck.checkNow}
        onChange={(event) => setUsername(event.target.value)}
        status={usernameStatus}
        value={username}
      />
      <AuthField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        onBlur={emailCheck.checkNow}
        onChange={(event) => setEmail(event.target.value)}
        status={emailStatus}
        value={email}
      />
      <AuthField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        onChange={(event) => setPassword(event.target.value)}
        status={passwordStatus}
        value={password}
      />
      <AuthField
        label="Confirmar contraseña"
        name="passwordConfirmation"
        type="password"
        autoComplete="new-password"
        onChange={(event) => setPasswordConfirmation(event.target.value)}
        status={confirmationStatus}
        value={passwordConfirmation}
      />
      <TurnstileWidget resetKey={state.message ?? "initial"} siteKey={siteKey} />
      {state.message ? <FormMessage state={state} /> : null}
      <button
        className={authButtonClassName}
        disabled={
          pending ||
          usernameCheck.pending ||
          emailCheck.pending ||
          !usernameReady ||
          !emailReady ||
          Boolean(passwordError) ||
          !passwordsMatch
        }
      >
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
  maxLength,
  name,
  onBlur,
  onChange,
  status,
  type = "text",
  value,
}: {
  autoComplete: string;
  label: string;
  maxLength?: number;
  name: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  status?: FieldStatus;
  type?: string;
  value?: string;
}) {
  return (
    <label className="text-sm font-semibold text-neutral-800">
      {label}
      <input
        className={authInputClassName}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-describedby={status ? `${name}-status` : undefined}
        maxLength={maxLength}
        minLength={type === "password" ? 8 : undefined}
        onBlur={onBlur}
        onChange={onChange}
        required
        value={value}
      />
      {status ? (
        <span
          id={`${name}-status`}
          aria-live="polite"
          className={`mt-1 block min-h-5 text-xs font-normal ${statusClassName(status.tone)}`}
        >
          {status.message}
        </span>
      ) : null}
    </label>
  );
}

type FieldStatus = {
  message: string;
  tone: "neutral" | "success" | "error";
};

function getAvailabilityStatus({
  availability,
  checking,
  emptyMessage,
  localError,
}: {
  availability: ReturnType<
    typeof useAccountAvailability
  >["availability"];
  checking: boolean;
  emptyMessage: string;
  localError: string | null;
}): FieldStatus {
  if (localError) {
    return { message: localError, tone: "error" };
  }

  if (checking) {
    return { message: "Comprobando disponibilidad...", tone: "neutral" };
  }

  if (availability) {
    return {
      message: availability.message,
      tone: availability.available ? "success" : "error",
    };
  }

  return { message: emptyMessage, tone: "neutral" };
}

function statusClassName(tone: FieldStatus["tone"]) {
  if (tone === "success") return "text-emerald-700";
  if (tone === "error") return "text-red-700";
  return "text-neutral-500";
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
