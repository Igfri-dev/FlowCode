import { useI18n } from "@/features/i18n/I18nProvider";
import { useEffect, useRef } from "react";
import type { useFlowWorkspaceRecovery } from "./workspace/useFlowWorkspaceRecovery";

export function FlowRecoveryPanel({
  recovery,
}: {
  recovery: ReturnType<typeof useFlowWorkspaceRecovery>;
}) {
  const { language } = useI18n();
  const es = language === "es";
  const recoveryDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = recoveryDialog.current;
    if (recovery.pendingDraft && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [recovery.pendingDraft]);
  return (
    <section
      aria-label={es ? "Estado del trabajo" : "Work status"}
      className="px-1 py-0.5 text-xs"
    >
      <p role="status" className="text-slate-500">
        <span
          aria-hidden="true"
          className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${recovery.isDirty ? "bg-amber-500" : "bg-emerald-500"}`}
        />
        {recovery.isDirty
          ? es
            ? "Cambios pendientes de guardar o entregar."
            : "Changes pending save or submission."
          : es
            ? "Sin cambios pendientes."
            : "No unsaved changes."}
        {recovery.draftSaved ? (
          <span className="ml-1 text-emerald-800">
            {es
              ? "Borrador guardado en este navegador."
              : "Draft saved in this browser."}
          </span>
        ) : null}
      </p>
      {recovery.storageError ? (
        <p role="alert" className="mt-2 text-amber-900">
          {es
            ? "No se pudo guardar o leer el borrador local. Guarda o exporta tu diagrama para conservarlo."
            : "The local draft could not be saved or read. Save or export your diagram to keep your work."}
        </p>
      ) : null}
      {recovery.pendingDraft ? (
        <dialog
          ref={recoveryDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="flow-recovery-title"
          onCancel={(event) => event.preventDefault()}
          className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm"
        >
          <p id="flow-recovery-title" className="font-semibold text-amber-950">
            {es
              ? "Hay un borrador de una sesión anterior."
              : "A draft from a previous session is available."}
          </p>
          <p className="mt-1 text-xs text-amber-900">
            {es
              ? "Recuperarlo reemplaza el diagrama abierto. Puedes deshacer esa recuperación."
              : "Restoring replaces the open diagram. You can undo the restoration."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={recovery.restoreDraft}
              className="fc-button fc-button--primary"
            >
              {es ? "Recuperar borrador" : "Restore draft"}
            </button>
            <button
              type="button"
              onClick={recovery.discardDraft}
              className="fc-button fc-button--secondary"
            >
              {es ? "Descartar borrador" : "Discard draft"}
            </button>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
