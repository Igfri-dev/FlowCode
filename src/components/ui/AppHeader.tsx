"use client";

import Image from "next/image";
import { useI18n } from "@/features/i18n/I18nProvider";
import logoImage from "../../app/logo.png";

export function AppHeader() {
  const { language, setLanguage, t } = useI18n();
  const nextLanguage = language === "es" ? "en" : "es";

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/95 shadow-sm shadow-neutral-200/70 backdrop-blur">
      <div className="flex h-16 w-full items-center justify-between gap-4 py-0 pl-0 pr-3 sm:pl-2 sm:pr-4 lg:pl-2 lg:pr-5 2xl:pl-3 2xl:pr-6">
        <div className="flex min-w-0 items-center">
          <Image
            src={logoImage}
            alt=""
            aria-hidden="true"
            className="h-25 w-auto shrink-0 translate-y-2 object-contain"
            priority
          />
          <div className="min-w-0">
            <span className="block text-xl font-semibold leading-tight text-neutral-950">
              FlowCode
            </span>
            <span className="block truncate text-xs font-medium text-neutral-500">
              {t("app.subtitle")}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label={t("language.toggle")}
          title={t("language.toggle")}
          onClick={() => setLanguage(nextLanguage)}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
        >
          <GlobeIcon />
          <span>{t(`language.${language}`)}</span>
        </button>
      </div>
    </header>
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
