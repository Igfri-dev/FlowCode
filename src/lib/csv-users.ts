import { getPasswordPolicyError, isValidEmail } from "@/lib/password-policy";

export const bulkUserCsvHeaders = [
  "nombre",
  "usuario",
  "contraseña",
  "correo",
  "tipo_de_usuario",
  "organizacion",
] as const;

export type BulkUserCsvRow = {
  line: number;
  fullName: string;
  username: string;
  password: string;
  email: string;
  role: "student" | "teacher";
  organization: string;
};

export type BulkUserCsvParseResult =
  | { ok: true; rows: BulkUserCsvRow[] }
  | { ok: false; errors: string[] };

const headerAliases = new Map([
  ["nombre", "nombre"],
  ["usuario", "usuario"],
  ["contrasena", "contraseña"],
  ["correo", "correo"],
  ["email", "correo"],
  ["tipo_de_usuario", "tipo_de_usuario"],
  ["tipodeusuario", "tipo_de_usuario"],
  ["organizacion", "organizacion"],
]);

export function parseBulkUsersCsv(text: string): BulkUserCsvParseResult {
  let records: string[][];

  try {
    records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "El CSV no es válido."],
    };
  }

  const nonEmptyRecords = records.filter((record) =>
    record.some((value) => value.trim()),
  );

  if (nonEmptyRecords.length < 2) {
    return { ok: false, errors: ["El CSV debe incluir encabezados y al menos un usuario."] };
  }

  if (nonEmptyRecords.length > 501) {
    return { ok: false, errors: ["Cada archivo puede contener como máximo 500 usuarios."] };
  }

  const normalizedHeaders = nonEmptyRecords[0].map(normalizeHeader);
  const headerPositions = new Map<string, number>();

  normalizedHeaders.forEach((header, index) => {
    const canonical = headerAliases.get(header);
    if (canonical) {
      headerPositions.set(canonical, index);
    }
  });

  const missingHeaders = bulkUserCsvHeaders.filter(
    (header) => !headerPositions.has(header),
  );

  if (missingHeaders.length) {
    return {
      ok: false,
      errors: [`Faltan columnas obligatorias: ${missingHeaders.join(", ")}.`],
    };
  }

  const rows: BulkUserCsvRow[] = [];
  const errors: string[] = [];
  const usernames = new Set<string>();
  const emails = new Set<string>();

  nonEmptyRecords.slice(1).forEach((record, index) => {
    const line = index + 2;
    const read = (header: (typeof bulkUserCsvHeaders)[number]) =>
      (record[headerPositions.get(header)!] ?? "").trim();
    const fullName = read("nombre");
    const username = read("usuario");
    const password = read("contraseña");
    const email = read("correo").toLowerCase();
    const roleValue = read("tipo_de_usuario").toLowerCase();
    const organization = read("organizacion");

    if (!fullName || !username || !email || !roleValue) {
      errors.push(`Línea ${line}: nombre, usuario, correo y tipo_de_usuario son obligatorios.`);
      return;
    }

    if (fullName.length > 160 || username.length > 80 || organization.length > 160) {
      errors.push(`Línea ${line}: uno de los textos supera el largo permitido.`);
      return;
    }

    if (!isValidEmail(email)) {
      errors.push(`Línea ${line}: el correo no es válido.`);
      return;
    }

    if (roleValue !== "student" && roleValue !== "teacher") {
      errors.push(`Línea ${line}: tipo_de_usuario debe ser student o teacher.`);
      return;
    }

    if (password) {
      const passwordError = getPasswordPolicyError(password);
      if (passwordError) {
        errors.push(`Línea ${line}: ${passwordError}`);
        return;
      }
    }

    const usernameKey = username.toLowerCase();
    if (usernames.has(usernameKey)) {
      errors.push(`Línea ${line}: el usuario ${username} está repetido en el archivo.`);
      return;
    }

    if (emails.has(email)) {
      errors.push(`Línea ${line}: el correo ${email} está repetido en el archivo.`);
      return;
    }

    usernames.add(usernameKey);
    emails.add(email);
    rows.push({
      line,
      fullName,
      username,
      password,
      email,
      role: roleValue,
      organization,
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true, rows };
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseCsvRecords(text: string) {
  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("El CSV contiene una comilla sin cerrar.");
  }

  if (field.length || record.length) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }

  return records;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = countOutsideQuotes(firstLine, ",");
  const semicolonCount = countOutsideQuotes(firstLine, ";");

  return semicolonCount > commaCount ? ";" : ",";
}

function countOutsideQuotes(value: string, delimiter: string) {
  let quoted = false;
  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') {
      if (quoted && value[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && value[index] === delimiter) {
      count += 1;
    }
  }

  return count;
}

