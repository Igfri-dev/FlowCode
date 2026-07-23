"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { AccountAvailabilityState } from "@/app/actions/auth";

// Cambia este valor para ajustar cuánto debe dejar de escribir el usuario.
export const ACCOUNT_AVAILABILITY_IDLE_MS = 700;

type AvailabilityAction = (
  value: string,
) => Promise<AccountAvailabilityState>;

export function useAccountAvailability({
  canCheck,
  check,
  failureMessage,
  idleMs = ACCOUNT_AVAILABILITY_IDLE_MS,
  value,
}: {
  canCheck: boolean;
  check: AvailabilityAction;
  failureMessage: string;
  idleMs?: number;
  value: string;
}) {
  const [availability, setAvailability] =
    useState<AccountAvailabilityState | null>(null);
  const [checkingValue, setCheckingValue] = useState<string | null>(null);
  const [transitionPending, startTransition] = useTransition();
  const timerRef = useRef<number | null>(null);
  const currentValueRef = useRef(value);
  const cacheRef = useRef(new Map<string, AccountAvailabilityState>());
  const inFlightRef = useRef(new Set<string>());
  currentValueRef.current = value;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runCheck = useCallback(
    (candidate: string) => {
      clearTimer();

      if (!candidate || !canCheck) {
        return;
      }

      const cached = cacheRef.current.get(candidate);
      if (cached) {
        setAvailability(cached);
        return;
      }

      if (inFlightRef.current.has(candidate)) {
        return;
      }

      inFlightRef.current.add(candidate);
      setCheckingValue(candidate);
      startTransition(async () => {
        try {
          const result = await check(candidate);
          cacheRef.current.set(candidate, result);
          if (currentValueRef.current === candidate) {
            setAvailability(result);
          }
        } catch {
          const result = {
            available: false,
            message: failureMessage,
            value: candidate,
          };
          if (currentValueRef.current === candidate) {
            setAvailability(result);
          }
        } finally {
          inFlightRef.current.delete(candidate);
          setCheckingValue((current) =>
            current === candidate ? null : current,
          );
        }
      });
    },
    [canCheck, check, clearTimer, failureMessage],
  );

  useEffect(() => {
    clearTimer();

    if (!value || !canCheck) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      runCheck(value);
    }, idleMs);

    return clearTimer;
  }, [canCheck, clearTimer, idleMs, runCheck, value]);

  const checkNow = useCallback(() => {
    runCheck(value);
  }, [runCheck, value]);

  const currentAvailability =
    availability?.value === value ? availability : null;

  return {
    availability: currentAvailability,
    checkNow,
    pending:
      transitionPending &&
      (checkingValue === value || inFlightRef.current.has(value)),
  };
}
