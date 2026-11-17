import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { RowDataPacket } from "mysql2/promise";

loadEnvConfig(process.cwd());

const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";

function decodeAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Submit the rendered Server Action form just as a browser without JS would.
async function submitForm(
  path: string,
  fields: Record<string, string>,
  cookie = "",
) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].find(
    (match) => match[1].includes(`name="${Object.keys(fields)[0]}"`),
  )?.[1];
  assert.ok(form, `Missing form at ${path}`);
  const body = new FormData();
  for (const input of form.matchAll(/<input\b[^>]*>/g)) {
    if (!input[0].includes('type="hidden"')) continue;
    const name = input[0].match(/\bname="([^"]*)"/)?.[1];
    const value = input[0].match(/\bvalue="([^"]*)"/)?.[1] ?? "";
    if (name) body.append(decodeAttribute(name), decodeAttribute(value));
  }
  assert.ok([...body.keys()].some((key) => key.startsWith("$ACTION_")));
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: baseUrl },
    body,
    redirect: "manual",
  });
}

function sessionCookie(response: Response) {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("flowcode_session="))
    ?.split(";")[0];
  assert.ok(cookie, "Expected a session cookie");
  return cookie;
}

async function main() {
  if (!/^flowcode_test_[0-9]+_[a-f0-9]{8}$/.test(process.env.MYSQL_DATABASE ?? "")) {
    throw new Error("First-login checks require an isolated database from npm run test:integration.");
  }
  const [{ getPool }, { verifyPassword }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/password"),
  ]);
  const pool = getPool();
  const username = process.env.FLOWCODE_BOOTSTRAP_ADMIN_USERNAME ?? "";
  const temporaryPassword = process.env.FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const newPassword = `${randomBytes(24).toString("hex")}2`;

  try {
    const login = await submitForm("/login", {
      username,
      password: temporaryPassword,
    });
    assert.equal(login.status, 303);
    assert.equal(login.headers.get("location"), "/change-password");
    const initialCookie = sessionCookie(login);
    for (const path of ["/", "/admin", "/admin/users"]) {
      const blocked = await fetch(`${baseUrl}${path}`, {
        headers: { Cookie: initialCookie },
        redirect: "manual",
      });
      assert.equal(blocked.headers.get("location"), "/change-password");
    }

    for (const [fields, message] of [
      [
        {
          currentPassword: "wrong-password1",
          newPassword,
          passwordConfirmation: newPassword,
        },
        /contraseña actual no es correcta/,
      ],
      [
        {
          currentPassword: temporaryPassword,
          newPassword: temporaryPassword,
          passwordConfirmation: temporaryPassword,
        },
        /debe ser diferente/,
      ],
      [
        {
          currentPassword: temporaryPassword,
          newPassword,
          passwordConfirmation: "different123",
        },
        /no coinciden/,
      ],
      [
        {
          currentPassword: temporaryPassword,
          newPassword: "short1",
          passwordConfirmation: "short1",
        },
        /al menos 8/,
      ],
    ] as const) {
      const invalid = await submitForm(
        "/change-password",
        fields,
        initialCookie,
      );
      assert.equal(invalid.status, 200);
      assert.match(await invalid.text(), message);
      const [users] = await pool.query<RowDataPacket[]>(
        "SELECT must_change_password FROM users WHERE username = ?",
        [username],
      );
      assert.equal(users[0].must_change_password, 1);
    }

    const changed = await submitForm(
      "/change-password",
      {
        currentPassword: temporaryPassword,
        newPassword,
        passwordConfirmation: newPassword,
      },
      initialCookie,
    );
    assert.equal(changed.status, 303);
    assert.equal(changed.headers.get("location"), "/admin");
    const newCookie = sessionCookie(changed);
    assert.notEqual(newCookie, initialCookie);
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT must_change_password, password_hash FROM users WHERE username = ?",
      [username],
    );
    assert.equal(users[0].must_change_password, 0);
    assert.ok(await verifyPassword(newPassword, users[0].password_hash));
    assert.equal(
      await verifyPassword(temporaryPassword, users[0].password_hash),
      false,
    );

    const staleSession = await fetch(`${baseUrl}/admin`, {
      headers: { Cookie: initialCookie },
      redirect: "manual",
    });
    assert.equal(staleSession.headers.get("location"), "/login");
    const admin = await fetch(`${baseUrl}/admin/users`, {
      headers: { Cookie: newCookie },
    });
    assert.equal(admin.status, 200);
    const oldLogin = await submitForm("/login", {
      username,
      password: temporaryPassword,
    });
    assert.equal(oldLogin.status, 200);
    assert.match(await oldLogin.text(), /no son correctos/);
    const newLogin = await submitForm("/login", {
      username,
      password: newPassword,
    });
    assert.equal(newLogin.headers.get("location"), "/admin");
    console.log(
      "Administrator first-login and mandatory password change checks passed.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
