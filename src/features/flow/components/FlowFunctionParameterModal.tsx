import { useState } from "react";
import {
  evaluateExpression,
  type ExecutionValue,
  type FlowExecutionFunctionParameterValues,
  type FlowExecutionPendingFunctionParameters,
} from "@/features/flow/execution";
import type { FlowFunctionParameterDefinition } from "@/types/flow";

type FlowFunctionParameterModalProps = {
  pendingFunctionParameters: FlowExecutionPendingFunctionParameters | null;
  onConfirm: (values: FlowExecutionFunctionParameterValues) => void;
};

export function FlowFunctionParameterModal({
  pendingFunctionParameters,
  onConfirm,
}: FlowFunctionParameterModalProps) {
  if (!pendingFunctionParameters) {
    return null;
  }

  return (
    <FlowFunctionParameterModalContent
      key={pendingFunctionParameters.functionId}
      pendingFunctionParameters={pendingFunctionParameters}
      onConfirm={onConfirm}
    />
  );
}

function FlowFunctionParameterModalContent({
  pendingFunctionParameters,
  onConfirm,
}: {
  pendingFunctionParameters: FlowExecutionPendingFunctionParameters;
  onConfirm: (values: FlowExecutionFunctionParameterValues) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pendingFunctionParameters.parameters.map((parameter) => [
        parameter.name,
        "",
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const result = parseParameterValues(
      pendingFunctionParameters.parameters,
      values,
    );

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onConfirm(result.values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-neutral-300 bg-white p-5 shadow-2xl shadow-neutral-950/20">
        <h2 className="text-lg font-semibold text-neutral-950">
          Parametros requeridos
        </h2>
        <p className="mt-2 text-sm text-neutral-700">
          Ingresa los valores para ejecutar {pendingFunctionParameters.functionName}.
        </p>
        <p className="mt-1 text-xs font-medium text-neutral-500">
          Puedes usar numeros, booleanos, texto, arreglos u objetos.
        </p>

        <div className="mt-4 space-y-3">
          {pendingFunctionParameters.parameters.map((parameter) => (
            <label key={parameter.name} className="block">
              <span className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-700">
                <span className="truncate">
                  {parameter.rest ? "..." : ""}
                  {parameter.name}
                </span>
                {parameter.defaultValue !== undefined ? (
                  <span className="shrink-0 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500">
                    defecto: {parameter.defaultValue}
                  </span>
                ) : null}
              </span>
              <input
                autoFocus={
                  parameter === pendingFunctionParameters.parameters[0]
                }
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 outline-none transition hover:border-neutral-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                placeholder={getParameterPlaceholder(parameter)}
                value={values[parameter.name] ?? ""}
                onChange={(event) => {
                  setValues((currentValues) => ({
                    ...currentValues,
                    [parameter.name]: event.target.value,
                  }));
                }}
              />
            </label>
          ))}
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm"
          >
            Ejecutar funcion
          </button>
        </div>
      </div>
    </div>
  );
}

function getParameterPlaceholder(parameter: FlowFunctionParameterDefinition) {
  if (parameter.rest) {
    return "[1, 2, 3]";
  }

  if (parameter.defaultValue !== undefined) {
    return "Deja vacio para usar el valor por defecto";
  }

  return '5, true o "texto"';
}

function parseParameterValues(
  parameters: FlowFunctionParameterDefinition[],
  rawValues: Record<string, string>,
):
  | { ok: true; values: FlowExecutionFunctionParameterValues }
  | { ok: false; message: string } {
  const parsedValues: FlowExecutionFunctionParameterValues = {};

  for (const parameter of parameters) {
    const rawValue = rawValues[parameter.name] ?? "";
    const trimmedValue = rawValue.trim();

    if (!trimmedValue && parameter.rest) {
      parsedValues[parameter.name] = [];
      continue;
    }

    if (!trimmedValue && parameter.defaultValue !== undefined) {
      continue;
    }

    if (!trimmedValue) {
      return {
        ok: false,
        message: `Ingresa un valor para "${parameter.name}".`,
      };
    }

    const parsedValue = parseParameterValue(rawValue);

    if (!parsedValue.ok) {
      return {
        ok: false,
        message: `Parametro "${parameter.name}": ${parsedValue.message}`,
      };
    }

    if (parameter.rest && !Array.isArray(parsedValue.value)) {
      return {
        ok: false,
        message: `Parametro "${parameter.name}": ingresa un arreglo como [1, 2, 3].`,
      };
    }

    parsedValues[parameter.name] = parsedValue.value;
  }

  return {
    ok: true,
    values: parsedValues,
  };
}

function parseParameterValue(
  value: string,
): { ok: true; value: ExecutionValue } | { ok: false; message: string } {
  const trimmedValue = value.trim();
  const expressionResult = evaluateExpression(trimmedValue, {});

  if (expressionResult.ok) {
    return expressionResult;
  }

  if (isPlainTextValue(trimmedValue)) {
    return {
      ok: true,
      value: trimmedValue,
    };
  }

  return {
    ok: false,
    message:
      "no se pudo interpretar el valor. Usa comillas para texto literal o una expresion valida.",
  };
}

function isPlainTextValue(value: string) {
  return !/[{}\[\](),;:+*\/\\"'`]/.test(value);
}
