import { useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";
import { FlowCodePanel } from "./FlowCodePanel";
import { FlowImportPanel } from "./FlowImportPanel";

export function FlowCodeTools({
  generatedCode,
  generatedWarnings,
  onGenerateCode,
  importCode,
  importMessage,
  importStatus,
  importWarnings,
  onImportCodeChange,
  onImportCode,
}: {
  generatedCode: string;
  generatedWarnings: string[];
  onGenerateCode: () => void;
  importCode: string;
  importMessage: string | null;
  importStatus: "idle" | "success" | "error";
  importWarnings: string[];
  onImportCodeChange: (code: string) => void;
  onImportCode: () => void;
}) {
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs =
    language === "es"
      ? ["Código generado", "Importar JavaScript"]
      : ["Generated code", "Import JavaScript"];
  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 1
          : event.key === "ArrowRight" || event.key === "ArrowLeft"
            ? 1 - index
            : null;
    if (next === null) return;
    event.preventDefault();
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  }
  return (
    <section
      className="workspace-panel !p-0 overflow-hidden"
      aria-label={language === "es" ? "Herramientas de código" : "Code tools"}
    >
      <div
        role="tablist"
        aria-label="JavaScript"
        className="flex gap-1 border-b border-slate-100 bg-slate-50/60 px-4 pt-2"
      >
        {tabs.map((label, index) => (
          <button
            key={label}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`flow-code-tab-${index}`}
            aria-controls={`flow-code-content-${index}`}
            aria-selected={activeTab === index}
            tabIndex={activeTab === index ? 0 : -1}
            onKeyDown={(event) => handleTabKey(event, index)}
            onClick={() => setActiveTab(index)}
            className={`border-b-2 px-3 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${activeTab === index ? "border-emerald-600 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {index === 0 ? (
              <span aria-hidden="true" className="mr-2 font-mono">
                {"</>"}
              </span>
            ) : null}
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="flow-code-content-0"
        aria-labelledby="flow-code-tab-0"
        hidden={activeTab !== 0}
        className="workspace-tool-body"
      >
        <FlowCodePanel
          code={generatedCode}
          warnings={generatedWarnings}
          onGenerateCode={onGenerateCode}
        />
      </div>
      <div
        role="tabpanel"
        id="flow-code-content-1"
        aria-labelledby="flow-code-tab-1"
        hidden={activeTab !== 1}
        className="workspace-tool-body"
      >
        <FlowImportPanel
          code={importCode}
          message={importMessage}
          status={importStatus}
          warnings={importWarnings}
          onCodeChange={onImportCodeChange}
          onImportCode={onImportCode}
        />
      </div>
    </section>
  );
}
