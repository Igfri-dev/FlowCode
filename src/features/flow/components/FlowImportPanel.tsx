type FlowImportPanelProps = {
  code: string;
  message: string | null;
  status: "idle" | "success" | "error";
  warnings: string[];
  onCodeChange: (code: string) => void;
  onImportCode: () => void;
};

export function FlowImportPanel({
  code,
  message,
  status,
  warnings,
  onCodeChange,
  onImportCode,
}: FlowImportPanelProps) {
  return (
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            Importar código JavaScript
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Usa variables, funciones, if/else, ciclos, switch y expresiones comunes.
          </p>
        </div>

        <button
          type="button"
          onClick={onImportCode}
          className="rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
        >
          Generar diagrama
        </button>
      </div>

      <textarea
        aria-label="Código JavaScript para importar"
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        placeholder={`let x = 0;
while (x < 5) {
  x = x + 1;
}`}
        className="mt-3 min-h-48 w-full resize-y rounded-md border border-neutral-300 bg-neutral-50 p-3 font-mono text-sm leading-6 text-neutral-950 outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
      />

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

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2">
          <p className="text-sm font-semibold text-yellow-950">Avisos</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-yellow-900">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
