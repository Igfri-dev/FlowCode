const turnstileVerificationEndpoint =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const developmentSiteKey = "1x00000000000000000000AA";
const developmentSecretKey = "1x0000000000000000000000000000000AA";

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  "error-codes"?: string[];
};

export function getTurnstileSiteKey() {
  const configuredKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (
    configuredKey &&
    !(process.env.NODE_ENV === "production" && configuredKey === developmentSiteKey)
  ) {
    return configuredKey;
  }

  return process.env.NODE_ENV === "production" ? null : developmentSiteKey;
}

export function isTurnstileConfigured() {
  return Boolean(getTurnstileSecretKey() && getTurnstileSiteKey());
}

export async function verifyTurnstileToken(
  token: string,
  expectedAction: string,
) {
  const secret = getTurnstileSecretKey();

  if (!secret) {
    return {
      ok: false,
      reason: "Turnstile no está configurado para el registro público.",
    } as const;
  }

  if (!token || token.length > 2048) {
    return {
      ok: false,
      reason: "Completa la verificación humana.",
    } as const;
  }

  try {
    const response = await fetch(turnstileVerificationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    const result = (await response.json()) as TurnstileResponse;

    if (
      !response.ok ||
      !result.success ||
      (result.action && result.action !== expectedAction) ||
      (process.env.NODE_ENV === "production" && result.action !== expectedAction)
    ) {
      return {
        ok: false,
        reason: "La verificación humana venció o no es válida. Inténtalo nuevamente.",
      } as const;
    }

    return { ok: true } as const;
  } catch {
    return {
      ok: false,
      reason: "No se pudo validar la verificación humana. Inténtalo nuevamente.",
    } as const;
  }
}

function getTurnstileSecretKey() {
  const configuredKey = process.env.TURNSTILE_SECRET_KEY;

  if (
    configuredKey &&
    !(process.env.NODE_ENV === "production" && configuredKey === developmentSecretKey)
  ) {
    return configuredKey;
  }

  return process.env.NODE_ENV === "production" ? null : developmentSecretKey;
}
