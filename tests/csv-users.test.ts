import assert from "node:assert/strict";
import test from "node:test";
import { parseBulkUsersCsv } from "../src/lib/csv-users";

test("parses quoted bulk users and optional passwords", () => {
  const result = parseBulkUsersCsv(
    [
      "nombre,usuario,contraseña,correo,tipo_de_usuario,organizacion",
      '"Pérez, Ana",ana,,ana@example.com,student,"Colegio Norte"',
      "Luis Soto,luis,clave123,luis@example.com,teacher,Colegio Norte",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.rows[0].fullName, "Pérez, Ana");
  assert.equal(result.rows[0].password, "");
  assert.equal(result.rows[1].role, "teacher");
});

test("accepts semicolon CSV and unaccented header aliases", () => {
  const result = parseBulkUsersCsv(
    "nombre;usuario;contrasena;correo;tipo_de_usuario;organizacion\nAna;ana;abc12345;ana@example.com;student;Norte",
  );

  assert.equal(result.ok, true);
});

test("reports duplicates and weak assigned passwords before provisioning", () => {
  const result = parseBulkUsersCsv(
    [
      "nombre,usuario,contraseña,correo,tipo_de_usuario,organizacion",
      "Ana débil,ana-debil,abcdefgh,ana1@example.com,student,Norte",
      "Ana,ana,abc12345,ana@example.com,student,Norte",
      "Ana 2,ana,abc12345,ana2@example.com,student,Norte",
    ].join("\n"),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(" "), /número/);
  assert.match(result.errors.join(" "), /repetido/);
});
