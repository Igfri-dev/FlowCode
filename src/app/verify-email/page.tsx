import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailForm } from "./VerifyEmailForm";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthShell
      eyebrow="Verificación"
      title="Confirma tu correo"
      description="Este paso activa tu cuenta personal y protege la recuperación de contraseña. El enlace es válido durante 48 horas y solo puede usarse una vez."
    >
      <VerifyEmailForm token={token} />
    </AuthShell>
  );
}
