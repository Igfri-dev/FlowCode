import mysql, { type QueryOptions, type RowDataPacket } from "mysql2/promise";

const globalForMysql = globalThis as typeof globalThis & {
  flowcodePool?: mysql.Pool;
};

export function getPool() {
  if (!globalForMysql.flowcodePool) {
    globalForMysql.flowcodePool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? "127.0.0.1",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "root",
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE ?? "flowcode",
      connectionLimit: 10,
      namedPlaceholders: true,
    });
  }

  return globalForMysql.flowcodePool;
}

export async function queryRows<T extends RowDataPacket>(
  sql: string,
  values: QueryOptions["values"] = [],
) {
  const [rows] = await getPool().query<T[]>(sql, values);

  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  sql: string,
  values: QueryOptions["values"] = [],
) {
  const rows = await queryRows<T>(sql, values);

  return rows[0] ?? null;
}
