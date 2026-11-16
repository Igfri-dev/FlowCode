import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it } from "node:test";
import { FlowTestResultDetails } from "@/features/flow/components/FlowTestResultDetails";

it("explains a missing technique even when the expected outputs match", () => {
  const html = renderToStaticMarkup(
    createElement(FlowTestResultDetails, {
      language: "es",
      cases: [
        {
          name: "Suma",
          passed: false,
          actualOutputs: ["15"],
          expectedOutputs: ["15"],
          outputsPassed: true,
          techniqueResults: [{ technique: "loop", passed: false }],
          message:
            "Outputs match, but required techniques were not demonstrated.",
        },
      ],
    }),
  );
  assert.match(html, /Las salidas coinciden, pero faltan técnicas requeridas/);
  assert.match(html, /Ciclo/);
  assert.match(html, /No se comprobó su uso en el resultado/);
});
it("preserves runtime error feedback when an output matched before execution failed", () => {
  const html = renderToStaticMarkup(
    createElement(FlowTestResultDetails, {
      language: "es",
      cases: [
        {
          name: "Suma",
          passed: false,
          actualOutputs: ["15"],
          expectedOutputs: ["15"],
          outputsPassed: true,
          techniqueResults: [{ technique: "loop", passed: false }],
          message: "Runtime failure: missingVariable",
        },
      ],
    }),
  );
  assert.match(html, /Runtime failure: missingVariable/);
  assert.doesNotMatch(
    html,
    /Las salidas coinciden, pero faltan técnicas requeridas/,
  );
});
it("renders historical results that predate technique validation", () => {
  const html = renderToStaticMarkup(
    createElement(FlowTestResultDetails, {
      language: "en",
      cases: [
        {
          name: "Legacy",
          passed: true,
          actualOutputs: ["15"],
          expectedOutputs: ["15"],
          message: "Passed",
        },
      ],
    }),
  );
  assert.match(html, /Passed/);
  assert.doesNotMatch(html, /Required techniques/);
});
