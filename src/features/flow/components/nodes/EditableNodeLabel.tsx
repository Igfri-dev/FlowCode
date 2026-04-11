type EditableNodeLabelProps = {
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  rows?: number;
};

export function EditableNodeLabel({
  value,
  onValueChange,
  ariaLabel,
  className = "",
  rows = 1,
}: EditableNodeLabelProps) {
  return (
    <textarea
      aria-label={ariaLabel}
      className={`nodrag nopan w-full resize-none overflow-hidden border-0 bg-transparent text-center outline-none ${className}`}
      rows={rows}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}
