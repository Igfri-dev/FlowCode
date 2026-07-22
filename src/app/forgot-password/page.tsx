import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Recuperación"
      title="¿Olvidaste tu contraseña?"
      description="Introduce el correo asociado a tu cuenta. Si lo encontramos, te enviaremos un enlace válido durante una hora."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}

