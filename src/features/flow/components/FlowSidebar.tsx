import type { FlowNodeType } from "@/types/flow";

type FlowSidebarProps = {
  onAddNode: (type: FlowNodeType) => void;
};

const blockActions: Array<{
  label: string;
  type: FlowNodeType;
  markerClassName: string;
}> = [
  {
    label: "Agregar Inicio",
    type: "start",
    markerClassName: "bg-emerald-500",
  },
  {
    label: "Agregar Fin",
    type: "end",
    markerClassName: "bg-red-600",
  },
  {
    label: "Agregar Proceso",
    type: "process",
    markerClassName: "bg-neutral-500",
  },
  {
    label: "Agregar Entrada",
    type: "input",
    markerClassName: "bg-sky-500",
  },
  {
    label: "Agregar Salida",
    type: "output",
    markerClassName: "bg-amber-500",
  },
  {
    label: "Agregar Decision",
    type: "decision",
    markerClassName: "bg-cyan-500",
  },
  {
    label: "Agregar Llamada a funcion",
    type: "functionCall",
    markerClassName: "bg-violet-500",
  },
  {
    label: "Agregar Retorno",
    type: "return",
    markerClassName: "bg-rose-500",
  },
];

export function FlowSidebar({ onAddNode }: FlowSidebarProps) {
  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70 transition hover:border-neutral-400/80 hover:shadow-lg hover:shadow-neutral-300/50">
      <div>
        <h2 className="text-base font-semibold text-neutral-950">Bloques</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Inserta bloques en el lienzo.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {blockActions.map((action) => (
          <button
            key={action.type}
            type="button"
            onClick={() => onAddNode(action.type)}
            className="group flex items-center gap-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125 ${action.markerClassName}`}
              aria-hidden="true"
            />
            {action.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
