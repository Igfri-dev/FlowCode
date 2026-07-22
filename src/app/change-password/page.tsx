import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { requireUserAllowingPasswordChange } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const user = await requireUserAllowingPasswordChange();

  if (!user.mustChangePassword) {
    redirect("/");
  }

  return (
    <AuthShell
      eyebrow="Primer inicio"
      title="Protege tu cuenta"
      description="Antes de continuar, reemplaza la contraseña inicial por una que solo tú conozcas."
    >
      <ChangePasswordForm />
    </AuthShell>
  );
}

