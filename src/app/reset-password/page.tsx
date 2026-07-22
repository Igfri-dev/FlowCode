import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthShell
      eyebrow="Seguridad"
      title="Elige una contraseña nueva"
      description="El enlace solo puede usarse una vez. Después tendrás que iniciar sesión de nuevo."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

