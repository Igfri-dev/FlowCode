import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import logoImage from "../logo.png";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; password?: string }>;
}) {
  const user = await getCurrentUser();
  const { email, password } = await searchParams;

  if (user) {
    redirect(user.role === "admin" || user.role === "teacher" ? "/admin" : "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-6 text-slate-950 sm:py-12">
      <section className="grid w-full max-w-[1080px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_80px_-32px_rgba(15,23,42,0.22)] lg:grid-cols-[minmax(0,1fr)_450px]">
        <div className="relative flex flex-col justify-between overflow-hidden bg-slate-950 p-6 text-white sm:p-8 lg:min-h-[640px] lg:p-10">
          <div className="flex items-center gap-3">
            <Image
              src={logoImage}
              alt=""
              aria-hidden="true"
              className="h-10 w-14 shrink-0 rounded-lg object-contain"
              preload
            />
            <div>
              <p className="text-xl font-bold tracking-tight">FlowCode</p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                Editor visual de algoritmos
              </p>
            </div>
          </div>

          <div className="mt-8 hidden max-w-xl lg:block">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">
              Piensa. Conecta. Aprende.
            </p>
            <h2 className="mt-4 max-w-sm text-[42px] font-semibold leading-[1.12] tracking-tight">
              Tus ideas,
              <br />
              <span className="text-emerald-400">paso a paso.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">
              Crea diagramas, explora cómo funcionan tus algoritmos y aprende en
              cada ejecución.
            </p>
            <AlgorithmPreview />
          </div>
          <div className="mt-6 hidden items-center gap-2 text-xs font-medium text-slate-400 lg:flex">
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              aria-hidden="true"
            />
            Un espacio para aprender y enseñar
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
              Tu espacio de trabajo
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Bienvenido de nuevo
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Inicia sesión con tu cuenta personal o de organización.
            </p>
          </div>

          <LoginForm
            notice={
              email === "verified"
                ? "Correo verificado. Ya puedes iniciar sesión."
                : password === "changed"
                  ? "Contraseña actualizada. Ya puedes iniciar sesión."
                  : undefined
            }
          />
        </div>
      </section>
    </main>
  );
}

function AlgorithmPreview() {
  return (
    <div
      aria-hidden="true"
      className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-4"
    >
      <svg viewBox="0 0 440 180" fill="none" className="w-full">
        <path
          d="M108 90h48m128 0h48"
          stroke="#34d399"
          strokeWidth="1.5"
          strokeDasharray="4 5"
        />
        <path
          d="m148 86 8 4-8 4m176-8 8 4-8 4"
          stroke="#34d399"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="12"
          y="68"
          width="96"
          height="44"
          rx="22"
          fill="#064e3b"
          stroke="#34d399"
        />
        <path
          d="m220 42 64 48-64 48-64-48 64-48Z"
          fill="#0f172a"
          stroke="#64748b"
        />
        <path
          d="M344 68h84l-12 44h-84l12-44Z"
          fill="#0f172a"
          stroke="#64748b"
        />
        <text
          x="60"
          y="94"
          fill="#d1fae5"
          textAnchor="middle"
          fontSize="12"
          fontFamily="inherit"
        >
          Inicio
        </text>
        <text
          x="220"
          y="94"
          fill="#cbd5e1"
          textAnchor="middle"
          fontSize="12"
          fontFamily="inherit"
        >
          ¿Se cumple?
        </text>
        <text
          x="380"
          y="94"
          fill="#cbd5e1"
          textAnchor="middle"
          fontSize="12"
          fontFamily="inherit"
        >
          Salida
        </text>
        <text
          x="302"
          y="76"
          fill="#34d399"
          textAnchor="middle"
          fontSize="10"
          fontFamily="inherit"
        >
          Sí
        </text>
      </svg>
    </div>
  );
}
