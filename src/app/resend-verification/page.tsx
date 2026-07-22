import { AuthShell } from "@/components/auth/AuthShell";
import { ResendVerificationForm } from "./ResendVerificationForm";

export default async function ResendVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;

  return (
    <AuthShell
      eyebrow="Verificación"
      title="Reenvía el enlace"
      description="Introduce el correo de la cuenta. Por privacidad mostraremos la misma respuesta exista o no una cuenta pendiente."
    >
      <ResendVerificationForm initialEmail={email} />
    </AuthShell>
  );
}
