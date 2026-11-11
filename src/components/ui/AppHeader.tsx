"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { SessionUser } from "@/lib/auth";
import logoImage from "../../app/logo.png";

type AppHeaderProps = {
  user: SessionUser;
  onLogout: () => Promise<void>;
};

export function AppHeader({ user, onLogout }: AppHeaderProps) {
  const { language, setLanguage, t } = useI18n();
  const nextLanguage = language === "es" ? "en" : "es";
  const es = language === "es";
  const roleLabel = {
    admin: es ? "Administrador" : "Administrator",
    teacher: es ? "Profesor" : "Teacher",
    student: es ? "Estudiante" : "Student",
    independent: es ? "Cuenta personal" : "Personal account",
  }[user.role];
  const destination =
    user.role === "admin" || user.role === "teacher"
      ? { href: "/admin", label: es ? "Panel" : "Dashboard" }
      : user.role === "student"
        ? {
            href: "/student/submissions",
            label: es ? "Mis entregas" : "My submissions",
          }
        : { href: "/projects", label: es ? "Mis proyectos" : "My projects" };
  const signOutLabel = es ? "Cerrar sesión" : "Sign out";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="app-header-inner flex h-16 w-full items-center justify-between gap-3 px-3 sm:h-[72px] sm:px-5 lg:px-6">
        <Link
          href="/"
          aria-label={es ? "FlowCode, abrir editor" : "FlowCode, open editor"}
          className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4"
        >
          <Image
            src={logoImage}
            alt=""
            aria-hidden="true"
            className="h-9 w-12 shrink-0 rounded-lg object-contain sm:h-10 sm:w-14"
            preload
          />
          <div className="min-w-0">
            <span className="block text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
              FlowCode
            </span>
            <span className="hidden truncate text-[11px] font-medium text-slate-500 sm:block">
              {t("app.subtitle")}
            </span>
          </div>
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="mr-2 hidden min-w-0 items-center gap-2.5 border-r border-slate-200 pr-4 lg:flex">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100"
            >
              {(user.fullName.trim() || user.username)
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="max-w-40 truncate text-xs font-semibold text-slate-800">
                {user.fullName}
              </p>
              <p className="max-w-40 truncate text-[11px] text-slate-500">
                {user.organizationName ?? roleLabel}
              </p>
            </div>
          </div>
          {user.email && !user.emailVerified ? (
            <Link
              href={`/resend-verification?email=${encodeURIComponent(user.email)}`}
              title={
                es
                  ? "Verifica tu correo para recuperar tu contraseña"
                  : "Verify your email to recover your password"
              }
              className="hidden rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 xl:inline-flex"
            >
              {es ? "Verificar correo" : "Verify email"}
            </Link>
          ) : null}
          <Link
            href={destination.href}
            title={destination.label}
            aria-label={destination.label}
            className={`${headerButtonClassName} bg-slate-50 hover:bg-slate-100`}
          >
            <WorkspaceIcon />
            <span className="hidden sm:inline">{destination.label}</span>
          </Link>
          <button
            type="button"
            aria-label={t("language.toggle")}
            title={t("language.toggle")}
            onClick={() => setLanguage(nextLanguage)}
            className={`${headerButtonClassName} hover:bg-slate-50`}
          >
            <GlobeIcon />
            <span>{t(`language.${language}`)}</span>
          </button>
          <form action={onLogout}>
            <button
              aria-label={signOutLabel}
              title={signOutLabel}
              className={`${headerButtonClassName} hover:bg-slate-50`}
            >
              <SignOutIcon />
              <span className="hidden md:inline">{signOutLabel}</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

const headerButtonClassName =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:px-3";

function WorkspaceIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h13" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21" />
      <path d="M12 3c-2.2 2.4-3.3 5.4-3.3 9S9.8 18.6 12 21" />
    </svg>
  );
}
