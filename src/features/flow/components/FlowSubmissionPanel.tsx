import { useMemo, useState } from "react";
import type { Exercise } from "@/features/exercises/types";
import { generateJavaScriptFromFlow } from "@/features/flow/codegen";
import type { FlowProgram } from "@/types/flow";

type FlowSubmissionPanelProps = {
  currentProgram: FlowProgram;
  selectedExercise: Exercise | null;
};

export function FlowSubmissionPanel({
  currentProgram,
  selectedExercise,
}: FlowSubmissionPanelProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const defaultTitle = useMemo(
    () => selectedExercise?.title ?? "FlowCode submission",
    [selectedExercise],
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
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: generatedCode.code,
          exerciseId: selectedExercise?.id ?? null,
          program: currentProgram,
          title: title.trim() || defaultTitle,
        }),
      });

      if (!response.ok) {
        throw new Error("Submission failed.");
      }

      setStatus("success");
      setMessage("Work submitted.");
      setTitle("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-neutral-950">
            Submit work
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Send the current diagram and generated JavaScript to your teacher.
          </p>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={defaultTitle}
            className="mt-3 w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-950 outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          className="rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
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
