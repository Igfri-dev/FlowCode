import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import logoImage from "../logo.png";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" || user.role === "teacher" ? "/admin" : "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-8 text-neutral-950">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl shadow-neutral-300/60 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex min-h-[420px] flex-col justify-between border-b border-neutral-200 bg-neutral-950 p-6 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <Image
              src={logoImage}
              alt=""
              aria-hidden="true"
              className="h-20 w-auto shrink-0 object-contain"
              priority
            />
            <div>
              <h1 className="text-3xl font-semibold leading-tight">FlowCode</h1>
              <p className="mt-1 text-sm font-medium text-neutral-300">
                Visual algorithm editor
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase text-emerald-300">
              Classroom workspace
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Build, submit, review, and run flow diagrams.
            </h2>
            <div className="mt-6 grid gap-2 text-sm text-neutral-300 sm:grid-cols-3">
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                student
              </span>
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                teacher
              </span>
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                admin
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              Account access
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Sign in</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Use your student, teacher, or admin account.
            </p>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
