const reservedUsernamePrefixes = [
  "admin",
  "administrador",
  "administradora",
  "administrator",
  "administracion",
  "administration",
  "administador",
  "superadmin",
] as const;

const reservedSystemUsernames = new Set([
  "root",
  "sistema",
  "system",
  "superuser",
  "superusuario",
]);

export function getUsernamePolicyError(username: string) {
  const trimmedUsername = username.trim();

  if (!trimmedUsername) {
    return "El nombre de usuario es obligatorio.";
  }

  if (trimmedUsername.length > 80) {
    return "El nombre de usuario no puede superar 80 caracteres.";
  }

  if (isReservedUsername(trimmedUsername)) {
    return "Ese nombre de usuario está reservado por seguridad.";
  }

  return null;
}

export function isReservedUsername(username: string) {
  const comparableUsername = username
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]/g, "");

  return (
    reservedUsernamePrefixes.some((prefix) =>
      comparableUsername.startsWith(prefix),
    ) ||
    reservedSystemUsernames.has(comparableUsername) ||
    /^(root|sistema|system|superuser|superusuario)\d+$/.test(comparableUsername)
  );
}
