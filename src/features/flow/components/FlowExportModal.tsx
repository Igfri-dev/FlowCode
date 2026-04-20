import { useState } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";

export type FlowImageExportFormat = "png" | "jpg" | "svg";

export type FlowExportOptions = {
  includeImage: boolean;
  imageFormat: FlowImageExportFormat;
  transparentBackground: boolean;
  includeJavaScript: boolean;
  includeJson: boolean;
};

type FlowExportModalProps = {
  error: string | null;
  isExporting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: FlowExportOptions) => void;
};

const defaultExportOptions: FlowExportOptions = {
  includeImage: true,
  imageFormat: "png",
  transparentBackground: false,
  includeJavaScript: false,
  includeJson: true,
};

export function FlowExportModal({
  error,
  isExporting,
  isOpen,
  onClose,
  onExport,
}: FlowExportModalProps) {
  const { t } = useI18n();
  const [options, setOptions] =
    useState<FlowExportOptions>(defaultExportOptions);
  const hasSelectedOption =
    options.includeImage || options.includeJavaScript || options.includeJson;
  const canUseTransparentBackground =
    options.includeImage && options.imageFormat !== "jpg";

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 px-4 py-6">
      <section
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-neutral-300 bg-white p-5 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              {t("flow.exportDialogTitle")}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {t("flow.exportDialogHelp")}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md bg-transparent px-2 py-1 text-xl leading-none text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-label={t("flow.closeExportDialog")}
            onClick={onClose}
          >
            x
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-emerald-700"
              checked={options.includeImage}
              onChange={(event) =>
                setOptions((currentOptions) => ({
                  ...currentOptions,
                  includeImage: event.target.checked,
                }))
              }
            />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {t("flow.exportAsImage")}
              </span>
              <span className="mt-1 block text-xs text-neutral-600">
                {t("flow.exportAsImageHelp")}
              </span>
            </span>
          </label>

          <label className="block pl-7 text-sm font-semibold text-neutral-800">
            {t("flow.exportImageFormat")}
            <select
              className="mt-1 block w-40 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm font-normal text-neutral-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
              value={options.imageFormat}
              disabled={!options.includeImage}
              onChange={(event) =>
                setOptions((currentOptions) => ({
                  ...currentOptions,
                  imageFormat: event.target.value as FlowImageExportFormat,
                  transparentBackground:
                    event.target.value === "jpg"
                      ? false
                      : currentOptions.transparentBackground,
                }))
              }
            >
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="svg">SVG</option>
            </select>
          </label>

          <label className="flex items-start gap-3 pl-7 text-sm text-neutral-900">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-emerald-700 disabled:cursor-not-allowed"
              checked={options.transparentBackground}
              disabled={!canUseTransparentBackground}
              onChange={(event) =>
                setOptions((currentOptions) => ({
                  ...currentOptions,
                  transparentBackground: event.target.checked,
                }))
              }
            />
            <span>
              <span className="block font-semibold">
                {t("flow.exportTransparentBackground")}
              </span>
              <span className="mt-1 block text-xs text-neutral-600">
                {t("flow.exportTransparentBackgroundHelp")}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-emerald-700"
              checked={options.includeJavaScript}
              onChange={(event) =>
                setOptions((currentOptions) => ({
                  ...currentOptions,
                  includeJavaScript: event.target.checked,
                }))
              }
            />
            <span>
              <span className="block font-semibold">
                {t("flow.exportJavaScript")}
              </span>
              <span className="mt-1 block text-xs text-neutral-600">
                {t("flow.exportJavaScriptHelp")}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-emerald-700"
              checked={options.includeJson}
              onChange={(event) =>
                setOptions((currentOptions) => ({
                  ...currentOptions,
                  includeJson: event.target.checked,
                }))
              }
            />
            <span>
              <span className="block font-semibold">
                {t("flow.exportJson")}
              </span>
              <span className="mt-1 block text-xs text-neutral-600">
                {t("flow.exportJsonHelp")}
              </span>
            </span>
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            disabled={isExporting}
            onClick={onClose}
          >
            {t("flow.cancel")}
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-neutral-600 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            disabled={!hasSelectedOption || isExporting}
            onClick={() => onExport(options)}
          >
            {isExporting ? t("flow.exporting") : t("flow.exportConfirm")}
          </button>
        </div>
      </section>
    </div>
  );
}
