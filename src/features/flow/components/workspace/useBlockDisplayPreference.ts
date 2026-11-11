import { useCallback, useEffect, useState } from "react";

export type BlockDisplayMode = "names" | "symbols";

const storageKey = "flowcode-block-display-mode";

export function useBlockDisplayPreference() {
  const [displayMode, setDisplayModeState] =
    useState<BlockDisplayMode>("names");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (isDisplayMode(saved)) setDisplayModeState(saved);
    } catch {
      // The selector remains usable when browser storage is unavailable.
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setDisplayModeState(
          isDisplayMode(event.newValue) ? event.newValue : "names",
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDisplayMode = useCallback((mode: BlockDisplayMode) => {
    setDisplayModeState(mode);
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      // Keep this session's preference even if persistence is blocked.
    }
  }, []);

  return { displayMode, setDisplayMode };
}

function isDisplayMode(value: string | null): value is BlockDisplayMode {
  return value === "names" || value === "symbols";
}
