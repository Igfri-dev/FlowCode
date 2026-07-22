import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  if (await getCurrentUser()) {
    redirect("/");
  }
  const siteKey = getTurnstileSiteKey();

  return (
    <AuthShell
      eyebrow="Cuenta personal"
      title="Crea tu espacio independiente"
      description="No necesitas pertenecer a una organización. Podrás crear diagramas, guardarlos y retomarlos cuando quieras."
    >
      {siteKey ? (
        <RegisterForm siteKey={siteKey} />
      ) : (
        <p className="mt-7 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          El registro público está temporalmente deshabilitado porque falta configurar Turnstile.
        </p>
      )}
    </AuthShell>
  );
}
