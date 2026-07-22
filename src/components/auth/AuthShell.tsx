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
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-8 text-neutral-950">
      <section className="w-full max-w-lg rounded-xl border border-neutral-300 bg-white p-6 shadow-xl shadow-neutral-300/60 sm:p-8">
        <Link href="/login" className="inline-flex items-center gap-2">
          <Image
            src={logoImage}
            alt=""
            aria-hidden="true"
            className="h-16 w-auto object-contain"
            priority
          />
          <span className="text-xl font-semibold">FlowCode</span>
        </Link>
        <p className="mt-6 text-sm font-semibold text-emerald-700">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
        {children}
      </section>
    </main>
  );
}

export const authInputClassName =
  "mt-2 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-950 outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20";

export const authButtonClassName =
  "rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

