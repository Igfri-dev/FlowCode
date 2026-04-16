import { useLayoutEffect, useRef } from "react";

type EditableNodeLabelProps = {
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  rows?: number;
  textAlign?: "center" | "left";
  autoResize?: boolean;
};

export function EditableNodeLabel({
  value,
  onValueChange,
  ariaLabel,
  className = "",
  rows = 1,
  textAlign = "center",
  autoResize = false,
}: EditableNodeLabelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const alignmentClassName = textAlign === "left" ? "text-left" : "text-center";

  useLayoutEffect(() => {
    if (!autoResize) {
      return;
    }

    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const resizeTextarea = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    resizeTextarea();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(resizeTextarea);
    resizeObserver.observe(textarea);

    return () => resizeObserver.disconnect();
  }, [autoResize, rows, value]);

  return (
    <textarea
      ref={textareaRef}
      aria-label={ariaLabel}
      className={`nodrag nopan nowheel w-full resize-none overflow-hidden border-0 bg-transparent ${alignmentClassName} outline-none select-text ${className}`}
      rows={rows}
      wrap="soft"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}
