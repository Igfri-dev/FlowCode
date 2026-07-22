import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverPendingEmails } from "@/lib/email";
import { ensureRuntimeSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "El procesador de correo no está configurado." },
      { status: 503 },
    );
  }

  if (!matchesSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    await ensureRuntimeSchema();
    const delivery = await deliverPendingEmails(100);

    return NextResponse.json(delivery, {
      status: delivery.configured ? 200 : 503,
    });
  } catch (error) {
    console.error("Email outbox cron failed", error);
    return NextResponse.json(
      { error: "No se pudo procesar la cola de correo." },
      { status: 500 },
    );
  }
}

function matchesSecret(authorization: string | null, secret: string) {
  const actual = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
