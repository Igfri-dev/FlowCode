type FlowAction = "undo" | "redo" | "import" | "export" | "clear" | "diagram";

export function FlowActionIcon({ action }: { action: FlowAction }) {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {action === "undo" ? (
        <path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14" />
      ) : null}
      {action === "redo" ? (
        <path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14" />
      ) : null}
      {action === "import" || action === "export" ? (
        <>
          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
          {action === "import" ? (
            <path d="M12 3v12m-4-4 4 4 4-4" />
          ) : (
            <path d="M12 15V3m-4 4 4-4 4 4" />
          )}
        </>
      ) : null}
      {action === "clear" ? (
        <>
          <path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7" />
        </>
      ) : null}
      {action === "diagram" ? (
        <>
          <rect x="7" y="2" width="10" height="6" rx="3" />
          <path d="M12 8v6m-3-3 3 3 3-3" />
          <rect x="5" y="16" width="14" height="6" rx="1.5" />
        </>
      ) : null}
    </svg>
  );
}
