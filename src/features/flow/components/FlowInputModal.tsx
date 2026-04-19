import { useState } from "react";
import type {
  ExecutionValue,
  FlowExecutionPendingInput,
} from "@/features/flow/execution";
import { useI18n } from "@/features/i18n/I18nProvider";

type FlowInputModalProps = {
  pendingInput: FlowExecutionPendingInput | null;
  onConfirm: (value: ExecutionValue) => void;
};

export function FlowInputModal({
  pendingInput,
  onConfirm,
}: FlowInputModalProps) {
  if (!pendingInput) {
    return null;
  }

  return (
    <FlowInputModalContent
      key={`${pendingInput.nodeId}-${pendingInput.variableName}-${pendingInput.inputType}`}
      pendingInput={pendingInput}
      onConfirm={onConfirm}
    />
  );
}

function FlowInputModalContent({
  pendingInput,
  onConfirm,
}: {
  pendingInput: FlowExecutionPendingInput;
  onConfirm: (value: ExecutionValue) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(
    pendingInput.inputType === "boolean" ? "true" : "",
  );
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const result = parseInputValue(value, pendingInput.inputType, t);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onConfirm(result.value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-neutral-300 bg-white p-5 shadow-2xl shadow-neutral-950/20">
        <h2 className="text-lg font-semibold text-neutral-950">
          {t("modal.inputTitle")}
        </h2>
        <p className="mt-2 text-sm text-neutral-700">{pendingInput.prompt}</p>
        <p className="mt-1 text-xs font-medium text-neutral-500">
          {t("modal.inputSavedIn")} {pendingInput.variableName}
        </p>

        <div className="mt-4">
          {pendingInput.inputType === "boolean" ? (
            <select
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition hover:border-neutral-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              autoFocus
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition hover:border-neutral-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              type={pendingInput.inputType === "number" ? "number" : "text"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
          >
            {t("modal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseInputValue(
  value: string,
  inputType: FlowExecutionPendingInput["inputType"],
  t: ReturnType<typeof useI18n>["t"],
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  if (inputType === "number") {
    if (value.trim() === "" || Number.isNaN(Number(value))) {
      return {
        ok: false,
        message: t("modal.validNumber"),
      };
    }

    return {
      ok: true,
      value: Number(value),
    };
  }

  if (inputType === "boolean") {
    return {
      ok: true,
      value: value === "true",
    };
  }

  if (!value.trim()) {
    return {
      ok: false,
      message: t("modal.validText"),
    };
  }

  return {
    ok: true,
    value,
  };
}
