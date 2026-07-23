import { randomBytes } from "node:crypto";

const minimumPasswordLength = 8;

export function getPasswordPolicyError(password: string) {
  if (password.length < minimumPasswordLength) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }

  if (!/\d/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }

  return null;
}

export function getPasswordConfirmationError(
  password: string,
  passwordConfirmation: string,
) {
  return password === passwordConfirmation
    ? null
    : "Las contraseñas no coinciden.";
}

export function isValidEmail(value: string) {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = randomBytes(16);
  const password = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);

  password[0] = String(bytes[0] % 10);

  return password.join("");
}
