import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import logoImage from "@/app/logo.png";

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 text-slate-950 sm:py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_64px_-24px_rgba(15,23,42,0.18)] sm:p-10">
        <Link
          href="/login"
          className="inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4"
        >
          <Image
            src={logoImage}
            alt=""
            aria-hidden="true"
            className="h-10 w-14 rounded-lg object-contain"
            preload
          />
          <span className="text-xl font-bold tracking-tight">FlowCode</span>
        </Link>
        <div className="mt-8 border-t border-slate-100 pt-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

export const authInputClassName =
  "mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10";

export const authButtonClassName =
  "min-h-11 rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-emerald-800 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
