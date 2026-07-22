import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const configuredInterval = Number(process.env.EMAIL_WORKER_INTERVAL_MS ?? 60_000);
const intervalMs = Number.isFinite(configuredInterval)
  ? Math.max(10_000, Math.floor(configuredInterval))
  : 60_000;
let stopping = false;
let timer: NodeJS.Timeout | null = null;

async function main() {
  const [{ getPool }, { deliverPendingEmails, isSmtpConfigured }, { ensureRuntimeSchema }] =
    await Promise.all([
      import("../src/lib/db"),
      import("../src/lib/email"),
      import("../src/lib/schema"),
    ]);

  if (!isSmtpConfigured()) {
    throw new Error("Configura SMTP_HOST y SMTP_FROM antes de iniciar el worker.");
  }

  await ensureRuntimeSchema();

  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    if (timer) clearTimeout(timer);
    console.info(`[email-worker] ${signal}: cerrando.`);
    await getPool().end();
  };

  process.once("SIGINT", () => void stop("SIGINT"));
  process.once("SIGTERM", () => void stop("SIGTERM"));

  const run = async () => {
    try {
      const delivery = await deliverPendingEmails(100);
      if (delivery.sent || delivery.failed || delivery.pending) {
        console.info(
          `[email-worker] enviados=${delivery.sent} fallidos=${delivery.failed} pendientes=${delivery.pending}`,
        );
      }
    } catch (error) {
      console.error("[email-worker] Falló el procesamiento de la cola:", error);
    } finally {
      if (!stopping) timer = setTimeout(run, intervalMs);
    }
  };

  console.info(`[email-worker] iniciado; intervalo=${intervalMs}ms.`);
  await run();
}

main().catch((error) => {
  console.error("[email-worker] No se pudo iniciar:", error);
  process.exitCode = 1;
});
