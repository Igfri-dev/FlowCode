import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Exercise } from "@/features/exercises/types";
import { generateJavaScriptFromFlow } from "@/features/flow/codegen";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { FlowProgram } from "@/types/flow";

type FlowSubmissionPanelProps = {
  currentProgram: FlowProgram;
  editingSubmission?: {
    id: number;
    title: string;
    submissionDeadline: string | null;
  };
  selectedExercise: Exercise | null;
  onSaved?: () => boolean;
};

export function FlowSubmissionPanel({
  currentProgram,
  editingSubmission,
  selectedExercise,
  onSaved,
}: FlowSubmissionPanelProps) {
  const { language } = useI18n();
  const es = language === "es";
  const router = useRouter();
  const [title, setTitle] = useState(editingSubmission?.title ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const defaultTitle = useMemo(
    () =>
      selectedExercise?.title ??
      (es ? "Entrega de FlowCode" : "FlowCode submission"),
    [es, selectedExercise],
  );

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage(null);

    const generatedCode = generateJavaScriptFromFlow({
      nodes: currentProgram.main.nodes,
      edges: currentProgram.main.edges,
      functions: currentProgram.functions,
    });

    try {
      const response = await fetch(
        editingSubmission
          ? `/api/submissions/${editingSubmission.id}`
          : "/api/submissions",
        {
          method: editingSubmission ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: generatedCode.code,
            exerciseId: selectedExercise?.id ?? null,
            exerciseKey:
              selectedExercise?.sourceId ?? selectedExercise?.id ?? null,
            exerciseLanguage: language,
            exerciseTitle: selectedExercise?.title ?? null,
            program: currentProgram,
            title: title.trim() || defaultTitle,
          }),
        },
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          result?.message ??
            (es ? "No se pudo entregar el trabajo." : "Submission failed."),
        );
      }

      setStatus("success");
      setMessage(
        es
          ? editingSubmission
            ? "Entrega actualizada."
            : "Trabajo entregado."
          : editingSubmission
            ? "Submission updated."
            : "Work submitted.",
      );
      const allChangesSaved = onSaved?.() ?? true;
      if (!allChangesSaved) {
        setMessage(
          es
            ? "Trabajo entregado. Hay cambios nuevos pendientes de guardar."
            : "Work submitted. New changes still need saving.",
        );
      }

      if (editingSubmission && allChangesSaved) {
        router.push("/student/submissions");
        router.refresh();
      } else if (allChangesSaved) {
        setTitle("");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="workspace-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-neutral-950">
            {es
              ? editingSubmission
                ? "Actualizar entrega"
                : "Entregar trabajo"
              : editingSubmission
                ? "Update submission"
                : "Submit work"}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {es
              ? editingSubmission
                ? "Guarda las correcciones y vuelve a enviar tu solución a revisión."
                : "Envía tu diagrama y código JavaScript al profesor."
              : editingSubmission
                ? "Save the corrected diagram. Its tests will run again and it will return to review."
                : "Send the current diagram and generated JavaScript to your teacher."}
          </p>
          {editingSubmission?.submissionDeadline ? (
            <p className="mt-1 text-xs font-semibold text-amber-800">
              {es ? "Editable hasta" : "Editable until"}{" "}
              {editingSubmission.submissionDeadline.replace("T", " ")}
            </p>
          ) : null}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={defaultTitle}
            aria-label={es ? "Título de la entrega" : "Submission title"}
            className="fc-field mt-3"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          className="fc-button fc-button--primary"
        >
          {isSubmitting
            ? editingSubmission
              ? es
                ? "Guardando…"
                : "Saving..."
              : es
                ? "Entregando…"
                : "Submitting..."
            : editingSubmission
              ? es
                ? "Guardar corrección"
                : "Save correction"
              : es
                ? "Entregar"
                : "Submit"}
        </button>
      </div>

      {message ? (
        <p
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            status === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
