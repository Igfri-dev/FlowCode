"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <div>
        <label
          className="text-sm font-semibold text-neutral-800"
          htmlFor="username"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          className="mt-2 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-950 outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
          required
        />
      </div>

      <div>
        <label
          className="text-sm font-semibold text-neutral-800"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-950 outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
          required
        />
      </div>

      {state.message ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
