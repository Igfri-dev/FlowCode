import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImportedFlowNode } from "@/features/flow/parser";
import type { FlowEditorNode, FlowProgram } from "@/types/flow";
import {
  createWorkspaceHistory,
  createWorkspaceSnapshot,
  getWorkspaceSignature,
  parseWorkspaceSnapshot,
  recordWorkspaceHistory,
  redoWorkspaceHistory,
  undoWorkspaceHistory,
  type WorkspaceHistory,
  type WorkspaceSnapshot,
} from "./flowWorkspaceHistory";

type RecoveredWorkspace = { snapshot: WorkspaceSnapshot; program: FlowProgram };

export function useFlowWorkspaceRecovery({
  activeDiagramId,
  currentProgram,
  selectedExerciseId,
  storageKey,
  ready,
  enabled,
  createEditorNodeFromImport,
  onRestore,
  onRequestLeave,
}: {
  activeDiagramId: string;
  currentProgram: FlowProgram;
  selectedExerciseId: string | null;
  storageKey?: string;
  ready: boolean;
  enabled: boolean;
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode;
  onRestore: (workspace: RecoveredWorkspace) => void;
  onRequestLeave: (proceed: () => void) => void;
}) {
  const router = useRouter();
  const snapshotText = JSON.stringify(
    createWorkspaceSnapshot(
      currentProgram,
      selectedExerciseId,
      activeDiagramId,
    ),
  );
  const snapshot = useMemo(
    () => JSON.parse(snapshotText) as WorkspaceSnapshot,
    [snapshotText],
  );
  const latestSnapshot = useRef(snapshot);
  latestSnapshot.current = snapshot;
  const signature = getWorkspaceSignature(snapshot);
  const history = useRef<WorkspaceHistory | null>(null);
  const initializedKey = useRef<string | null>(null);
  const lastEditAt = useRef(0);
  const skipRecordSignature = useRef<string | null>(null);
  const allowNavigation = useRef(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const baselineRef = useRef<string | null>(null);
  const [baselineSignature, setBaselineSignature] = useState<string | null>(
    null,
  );
  const [pendingDraft, setPendingDraft] = useState<RecoveredWorkspace | null>(
    null,
  );
  const pendingDraftRef = useRef<RecoveredWorkspace | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const active = enabled && ready;
  const isDirty =
    active && baselineSignature !== null && signature !== baselineSignature;

  useEffect(() => {
    const key = storageKey ?? "history-only";
    if (!active || initializedKey.current === key) return;
    initializedKey.current = key;
    history.current = createWorkspaceHistory(snapshot);
    baselineRef.current = getWorkspaceSignature(snapshot);
    setBaselineSignature(baselineRef.current);
    pendingDraftRef.current = null;
    setPendingDraft(null);
    setDraftSaved(false);
    setStorageError(false);
    setHistoryVersion((version) => version + 1);
    if (!storageKey) return;

    try {
      const value = window.localStorage.getItem(storageKey);
      if (!value) return;
      const draft = JSON.parse(value) as {
        schema?: unknown;
        version?: unknown;
        snapshot?: unknown;
      } | null;
      const recovered =
        draft?.schema === "flowcode.workspace-draft" && draft.version === 1
          ? parseWorkspaceSnapshot(
              JSON.stringify(draft.snapshot),
              createEditorNodeFromImport,
            )
          : null;
      if (!recovered) {
        setStorageError(true);
        return;
      }
      if (
        getWorkspaceSignature(recovered.snapshot) !==
        getWorkspaceSignature(snapshot)
      ) {
        pendingDraftRef.current = recovered;
        setPendingDraft(recovered);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      setStorageError(true);
    }
  }, [active, createEditorNodeFromImport, snapshot, storageKey]);

  useEffect(() => {
    if (!active || !history.current) return;
    if (skipRecordSignature.current === signature) {
      skipRecordSignature.current = null;
      return;
    }
    const now = Date.now();
    const contentChanged =
      getWorkspaceSignature(history.current.present) !== signature;
    const next = recordWorkspaceHistory(
      history.current,
      snapshot,
      now - lastEditAt.current < 450,
    );
    if (next !== history.current) {
      history.current = next;
      if (contentChanged) lastEditAt.current = now;
      setHistoryVersion((version) => version + 1);
    }
  }, [active, signature, snapshot]);

  const persistDraft = useCallback(() => {
    if (
      !active ||
      !storageKey ||
      baselineRef.current === null ||
      pendingDraftRef.current
    )
      return;
    try {
      const latest = latestSnapshot.current;
      if (getWorkspaceSignature(latest) === baselineRef.current) {
        window.localStorage.removeItem(storageKey);
        setDraftSaved(false);
      } else {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            schema: "flowcode.workspace-draft",
            version: 1,
            savedAt: new Date().toISOString(),
            snapshot: latest,
          }),
        );
        setDraftSaved(true);
      }
      setStorageError(false);
    } catch {
      setDraftSaved(false);
      setStorageError(true);
    }
  }, [active, baselineSignature, pendingDraft, storageKey]);
  const persistOnUnmount = useRef(persistDraft);
  persistOnUnmount.current = persistDraft;
  useEffect(() => () => persistOnUnmount.current(), []);

  useEffect(() => {
    if (!active) return;
    setDraftSaved(false);
    const timer = window.setTimeout(persistDraft, 300);
    return () => window.clearTimeout(timer);
  }, [active, snapshot, persistDraft]);

  useEffect(() => {
    if (!active) return;
    const flush = () => persistDraft();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      persistDraft();
      if (isDirty && !allowNavigation.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const visibilityChange = () => {
      if (document.visibilityState === "hidden") persistDraft();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [active, isDirty, persistDraft]);

  useEffect(() => {
    if (!isDirty) return;
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(target instanceof HTMLAnchorElement) ||
        target.download ||
        (target.target && target.target !== "_self")
      )
        return;
      const url = new URL(target.href, window.location.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      onRequestLeave(() => {
        persistDraft();
        allowNavigation.current = true;
        if (url.origin === window.location.origin) {
          router.push(`${url.pathname}${url.search}${url.hash}`);
        } else {
          window.location.assign(url.href);
        }
      });
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [isDirty, onRequestLeave, persistDraft, router]);

  useEffect(() => {
    if (!isDirty) return;
    const submit = (event: SubmitEvent) => {
      if (
        event.defaultPrevented ||
        allowNavigation.current ||
        !(event.target instanceof HTMLFormElement)
      )
        return;
      const form = event.target;
      const submitter = event.submitter;
      event.preventDefault();
      event.stopPropagation();
      onRequestLeave(() => {
        persistDraft();
        allowNavigation.current = true;
        form.requestSubmit(submitter);
      });
    };
    document.addEventListener("submit", submit, true);
    return () => document.removeEventListener("submit", submit, true);
  }, [isDirty, onRequestLeave, persistDraft]);

  const applyHistory = useCallback(
    (direction: "undo" | "redo") => {
      if (!history.current) return;
      const current = recordWorkspaceHistory(
        history.current,
        latestSnapshot.current,
        true,
      );
      const next =
        direction === "undo"
          ? undoWorkspaceHistory(current)
          : redoWorkspaceHistory(current);
      if (next === current) return;
      const recovered = parseWorkspaceSnapshot(
        JSON.stringify(next.present),
        createEditorNodeFromImport,
      );
      if (!recovered) return;
      history.current = next;
      skipRecordSignature.current = getWorkspaceSignature(next.present);
      lastEditAt.current = 0;
      onRestore(recovered);
      setHistoryVersion((version) => version + 1);
    },
    [createEditorNodeFromImport, onRestore],
  );
  const undo = useCallback(() => applyHistory("undo"), [applyHistory]);
  const redo = useCallback(() => applyHistory("redo"), [applyHistory]);

  useEffect(() => {
    if (!active) return;
    const keyDown = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.defaultPrevented
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          "input,textarea,select,[contenteditable='true'],[role='textbox']",
        )
      )
        return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") {
        event.preventDefault();
        if (key === "y" || event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [active, redo, undo]);

  const restoreDraft = useCallback(() => {
    if (!pendingDraft || !history.current) return;
    history.current = recordWorkspaceHistory(
      history.current,
      pendingDraft.snapshot,
    );
    skipRecordSignature.current = getWorkspaceSignature(pendingDraft.snapshot);
    lastEditAt.current = 0;
    onRestore(pendingDraft);
    pendingDraftRef.current = null;
    setPendingDraft(null);
    setHistoryVersion((version) => version + 1);
  }, [onRestore, pendingDraft]);

  const discardDraft = useCallback(() => {
    pendingDraftRef.current = null;
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    setPendingDraft(null);
  }, [storageKey]);

  // This callback captures the exact snapshot sent by the saving component.
  // Edits made while a request is in flight remain dirty and recoverable.
  const markSaved = useCallback(() => {
    const savedSignature = getWorkspaceSignature(snapshot);
    const latest = latestSnapshot.current;
    const allChangesSaved = getWorkspaceSignature(latest) === savedSignature;
    baselineRef.current = savedSignature;
    setBaselineSignature(savedSignature);
    pendingDraftRef.current = null;
    setPendingDraft(null);
    let storedLatest = false;
    try {
      if (storageKey) {
        if (allChangesSaved) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({
              schema: "flowcode.workspace-draft",
              version: 1,
              savedAt: new Date().toISOString(),
              snapshot: latest,
            }),
          );
          storedLatest = true;
        }
      }
    } catch {
      setStorageError(true);
    }
    setDraftSaved(storedLatest);
    return allChangesSaved;
  }, [snapshot, storageKey]);

  return {
    canUndo:
      active && historyVersion > 0 && Boolean(history.current?.past.length),
    canRedo:
      active && historyVersion > 0 && Boolean(history.current?.future.length),
    undo,
    redo,
    isDirty,
    draftSaved,
    storageError,
    pendingDraft: pendingDraft !== null,
    restoreDraft,
    discardDraft,
    markSaved,
  };
}
