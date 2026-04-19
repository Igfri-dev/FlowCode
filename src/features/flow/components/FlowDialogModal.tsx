import { useEffect } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";

type FlowDialogTone = "danger" | "warning";

export type FlowDialogRequest = {
  cancelLabel?: string;
  confirmLabel: string;
  message: string;
  title: string;
  tone?: FlowDialogTone;
};

type FlowDialogModalProps = {
  request: FlowDialogRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function FlowDialogModal({
  request,
  onCancel,
  onConfirm,
}: FlowDialogModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!request) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, request]);

  if (!request) {
    return null;
  }

  const tone = request.tone ?? "warning";
  const confirmClassName =
    tone === "danger"
      ? "rounded-md border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-red-800 hover:bg-red-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
      : "rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 px-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        aria-labelledby="flow-dialog-title"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-neutral-300 bg-white p-5 shadow-2xl shadow-neutral-950/20"
        role="dialog"
      >
        <h2
          className="text-lg font-semibold text-neutral-950"
          id="flow-dialog-title"
        >
          {request.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-700">
          {request.message}
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
            onClick={onCancel}
          >
            {request.cancelLabel ?? t("flow.cancel")}
          </button>
          <button
            type="button"
            autoFocus
            className={confirmClassName}
            onClick={onConfirm}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
