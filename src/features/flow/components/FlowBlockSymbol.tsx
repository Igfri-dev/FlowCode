import type { FlowNodeType } from "@/types/flow";

export function FlowBlockSymbol({
  type,
  className = "h-8 w-12",
}: {
  type: FlowNodeType;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {type === "start" || type === "end" ? (
        <>
          <rect
            x="8"
            y="9"
            width="48"
            height="26"
            rx="13"
            fill="currentColor"
            fillOpacity=".06"
          />
          {type === "start" ? (
            <path d="m29 16 9 6-9 6z" fill="currentColor" stroke="none" />
          ) : (
            <rect
              x="27"
              y="17"
              width="10"
              height="10"
              rx="1.5"
              fill="currentColor"
              stroke="none"
            />
          )}
        </>
      ) : type === "process" ? (
        <>
          <rect
            x="9"
            y="8"
            width="46"
            height="28"
            rx="3"
            fill="currentColor"
            fillOpacity=".06"
          />
          <path d="m25 16-6 6 6 6m14-12 6 6-6 6m-5-14-4 16" />
        </>
      ) : type === "decision" ? (
        <>
          <path
            d="m32 3 26 19-26 19L6 22z"
            fill="currentColor"
            fillOpacity=".06"
          />
          <path d="M28 18a4 4 0 1 1 6 3.5c-2 1-2 2-2 3.5" />
          <circle cx="32" cy="29" r="1" fill="currentColor" stroke="none" />
        </>
      ) : type === "input" || type === "output" ? (
        <>
          <path d="m17 8 39 0-9 28H8z" fill="currentColor" fillOpacity=".06" />
          {type === "input" ? (
            <path d="M3 22h31m-6-6 6 6-6 6" />
          ) : (
            <path d="M30 22h31m-6-6 6 6-6 6" />
          )}
        </>
      ) : type === "functionCall" ? (
        <>
          <rect
            x="7"
            y="8"
            width="50"
            height="28"
            rx="2"
            fill="currentColor"
            fillOpacity=".06"
          />
          <path d="M15 8v28M49 8v28m-13-20h-3c-2 0-3 1-3 3v9c0 2-1 3-3 3m-1-11h10" />
        </>
      ) : (
        <>
          <path
            d="m18 8 38 0-9 28H18L7 22z"
            fill="currentColor"
            fillOpacity=".06"
          />
          <path d="M43 15v6a5 5 0 0 1-5 5H23m6-6-6 6 6 6" />
        </>
      )}
    </svg>
  );
}
