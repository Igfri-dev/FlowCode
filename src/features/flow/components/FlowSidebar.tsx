import { useI18n } from "@/features/i18n/I18nProvider";
import type { TranslationKey } from "@/features/i18n/translations";
import type { FlowNodeType } from "@/types/flow";
import { FlowBlockSymbol } from "./FlowBlockSymbol";
import type { BlockDisplayMode } from "./workspace/useBlockDisplayPreference";

type FlowSidebarProps = {
  layout?: "vertical" | "horizontal";
  displayMode?: BlockDisplayMode;
  onDisplayModeChange?: (mode: BlockDisplayMode) => void;
  onAddNode: (type: FlowNodeType) => void;
};

const blockActions: Array<{
  labelKey: TranslationKey;
  type: FlowNodeType;
  colorClassName: string;
}> = [
  {
    labelKey: "flow.addStart",
    type: "start",
    colorClassName: "text-emerald-700",
  },
  { labelKey: "flow.addEnd", type: "end", colorClassName: "text-rose-600" },
  {
    labelKey: "flow.addProcess",
    type: "process",
    colorClassName: "text-slate-600",
  },
  { labelKey: "flow.addInput", type: "input", colorClassName: "text-sky-700" },
  {
    labelKey: "flow.addOutput",
    type: "output",
    colorClassName: "text-amber-700",
  },
  {
    labelKey: "flow.addDecision",
    type: "decision",
    colorClassName: "text-teal-700",
  },
  {
    labelKey: "flow.addFunctionCall",
    type: "functionCall",
    colorClassName: "text-violet-600",
  },
  {
    labelKey: "flow.addReturn",
    type: "return",
    colorClassName: "text-pink-700",
  },
];

export function FlowSidebar({
  layout = "vertical",
  displayMode = "names",
  onDisplayModeChange,
  onAddNode,
}: FlowSidebarProps) {
  const { language, t } = useI18n();
  const es = language === "es";
  const isHorizontal = layout === "horizontal";
  const symbolsOnly = displayMode === "symbols";

  return (
    <aside className="flow-block-palette min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.12)]">
      <div
        className={
          isHorizontal
            ? "flex flex-wrap items-center justify-between gap-3"
            : "space-y-3"
        }
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              {t("flow.blocks")}
            </h2>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500">
              08
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t("flow.blocksHelp")}
          </p>
        </div>
        <div
          role="group"
          aria-label={es ? "Vista de los bloques" : "Block display"}
          className={`inline-flex rounded-lg bg-slate-100 p-1 ${isHorizontal ? "" : "w-full"}`}
        >
          {(["names", "symbols"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={displayMode === mode}
              onClick={() => onDisplayModeChange?.(mode)}
              className={`flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${displayMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {mode === "names" ? <NamesIcon /> : <SymbolsIcon />}
              {mode === "names"
                ? es
                  ? "Nombres"
                  : "Names"
                : es
                  ? "Símbolos"
                  : "Symbols"}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`mt-4 ${isHorizontal ? "flex max-w-[calc(100vw-5rem)] gap-2 overflow-x-auto pb-1" : symbolsOnly ? "grid grid-cols-2 gap-2" : "grid gap-1.5"}`}
      >
        {blockActions.map((action) => {
          const actionLabel = t(action.labelKey);
          const blockName = actionLabel.replace(/^Agregar |^Add /, "");
          return (
            <button
              key={action.type}
              type="button"
              data-block-type={action.type}
              aria-label={actionLabel}
              title={actionLabel}
              onClick={() => onAddNode(action.type)}
              className={`group relative flex shrink-0 items-center rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${symbolsOnly ? "min-h-20 justify-center border-slate-200/80 bg-slate-50/50 p-3 hover:border-teal-300 hover:bg-teal-50/60" : "gap-3 border-transparent bg-white px-2 py-1.5 hover:border-slate-200 hover:bg-slate-50"} ${isHorizontal ? (symbolsOnly ? "min-w-20" : "min-w-40") : ""}`}
            >
              <span
                className={`flex shrink-0 items-center justify-center ${action.colorClassName} ${symbolsOnly ? "h-12 w-16" : "h-9 w-10 rounded-lg bg-slate-50 group-hover:bg-white"}`}
              >
                <FlowBlockSymbol
                  type={action.type}
                  className={symbolsOnly ? "h-12 w-16" : "h-8 w-10"}
                />
              </span>
              {!symbolsOnly ? (
                <>
                  <span className="min-w-0 flex-1 text-xs font-medium leading-5 text-slate-700 group-hover:text-slate-950">
                    {blockName}
                  </span>
                  <span
                    aria-hidden="true"
                    className="pr-1 text-base font-light text-slate-300 group-hover:text-teal-600"
                  >
                    +
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function NamesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-3.5 w-3.5"
    >
      <path d="M3 4h10M3 8h10M3 12h7" strokeLinecap="round" />
    </svg>
  );
}

function SymbolsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className="h-3.5 w-3.5"
    >
      <rect x="2" y="2" width="4" height="4" rx="1" />
      <path d="m11 1 4 3-4 3-4-3z" />
      <rect x="2" y="10" width="4" height="4" rx="2" />
      <rect x="9" y="10" width="5" height="4" rx=".5" />
    </svg>
  );
}
