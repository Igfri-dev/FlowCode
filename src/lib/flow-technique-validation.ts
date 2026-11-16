import { parse } from "@babel/parser";
import {
  evaluateExpression,
  type ExecutionVariables,
} from "@/features/flow/execution";
import type {
  FlowEditorDiagram,
  FlowEditorNode,
  FlowProgram,
} from "@/types/flow";

export const exerciseTechniques = [
  "loop",
  "for",
  "doWhile",
  "decision",
  "switch",
  "function",
  "input",
  "modulo",
  "accumulator",
  "stringMethods",
  "optionalChaining",
  "array",
  "object",
  "math",
] as const;
export type ExerciseTechnique = (typeof exerciseTechniques)[number];
export type TechniqueCheck = { technique: ExerciseTechnique; passed: boolean };
export type TechniqueExecutionStep = {
  diagramId: string;
  nodeId: string;
  variablesBefore: ExecutionVariables;
  variablesAfter: ExecutionVariables;
};
type Facts = {
  reads: Set<string>;
  writes: Set<string>;
  features: Set<ExerciseTechnique>;
};
type Provenance = Set<number>;
type Environment = Map<string, Provenance>;
type Control = { index: number; until?: string };
type Scope = {
  environment: Environment;
  controls: Control[];
  calls: number[];
  inherited: Set<string>;
  assignTo?: string;
};
type DiagramInfo = {
  diagram: FlowEditorDiagram;
  nodes: Map<string, FlowEditorNode>;
  outgoing: Map<string, string[]>;
  loops: Map<string, Set<string>>;
  joins: Map<string, string | undefined>;
};

export function getTechniqueLabel(
  technique: ExerciseTechnique,
  language: "es" | "en" = "es",
) {
  const labels: Record<ExerciseTechnique, [string, string]> = {
    loop: ["Ciclo", "Loop"],
    for: ["Ciclo for", "For loop"],
    doWhile: ["Ciclo do while", "Do-while loop"],
    decision: ["Decisiones", "Decisions"],
    switch: ["Selección switch", "Switch selection"],
    function: ["Funciones", "Functions"],
    input: ["Entrada de datos", "Input"],
    modulo: ["Operador módulo", "Modulo operator"],
    accumulator: ["Acumulador", "Accumulator"],
    stringMethods: ["Métodos de texto", "String methods"],
    optionalChaining: ["Acceso opcional", "Optional chaining"],
    array: ["Arreglos", "Arrays"],
    object: ["Objetos", "Objects"],
    math: ["Operaciones Math", "Math operations"],
  };
  return labels[technique][language === "es" ? 0 : 1];
}

/** Executed constructs must contribute data or control to an observed output.
 * A dynamic backward slice excludes disconnected blocks, overwritten values and
 * unused computations. It is pedagogical evidence, not proof of equivalence for
 * every possible input; output cases remain an independent requirement.
 */
export function evaluateFlowTechniques({
  program,
  trace,
  requirements,
}: {
  program: FlowProgram;
  trace: TechniqueExecutionStep[];
  requirements: ExerciseTechnique[];
}) {
  if (requirements.length === 0)
    return { passed: true, checks: [] as TechniqueCheck[] };
  const diagrams = new Map<string, DiagramInfo>([
    ["main", diagramInfo(program.main)],
    ...program.functions.map((fn) => [fn.id, diagramInfo(fn)] as const),
  ]);
  const dependencies: Provenance[] = trace.map(() => new Set());
  const dataDependencies: Provenance[] = trace.map(() => new Set());
  const features: Set<ExerciseTechnique>[] = trace.map(() => new Set());
  const indices = new Map<string, number[]>();
  trace.forEach((step, index) => {
    const key = `${step.diagramId}\0${step.nodeId}`;
    const entries = indices.get(key) ?? [];
    entries.push(index);
    indices.set(key, entries);
  });
  const outputs: number[] = [];
  const scopes: Scope[] = [
    { environment: new Map(), controls: [], calls: [], inherited: new Set() },
  ];
  for (let index = 0; index < trace.length; index++) {
    const step = trace[index],
      info = diagrams.get(step.diagramId),
      node = info?.nodes.get(step.nodeId);
    if (!node || !info) continue;
    const scope = scopes[scopes.length - 1];
    scope.controls = scope.controls.filter(
      (control) => control.until !== node.id,
    );
    const facts = nodeFacts(node, step.variablesBefore);
    features[index] = new Set(facts.features);
    const deps = dependencies[index];
    for (const name of facts.reads) {
      union(deps, scope.environment.get(name));
      union(dataDependencies[index], scope.environment.get(name));
    }
    for (const control of scope.controls) deps.add(control.index);
    for (const call of scope.calls) deps.add(call);
    // Loop bodies can precede their condition (do-while). Their dependence on
    // that executed condition is represented explicitly, including future steps.
    for (const [conditionId, members] of info.loops) {
      if (!members.has(node.id)) continue;
      const executions = indices.get(`${step.diagramId}\0${conditionId}`) ?? [];
      const condition = info.nodes.get(conditionId)!;
      const conditionFacts = nodeFacts(condition, step.variablesBefore);
      if (!conditionFacts.reads.size || !executions.length) continue;
      const kind =
        "controlFlow" in condition.data.config
          ? condition.data.config.controlFlow?.kind
          : undefined;
      if (executions.length < 2 && kind !== "doWhile") continue;
      const conditionIndex =
        executions.find((candidate) => candidate >= index) ??
        executions[executions.length - 1];
      if (conditionIndex !== index) deps.add(conditionIndex);
      features[conditionIndex].add("loop");
      if (kind === "for") features[conditionIndex].add("for");
      if (kind === "doWhile") features[conditionIndex].add("doWhile");
    }
    if (node.type === "decision") {
      const isLoop = info.loops.has(node.id);
      // Constant guards and two identical arms do not demonstrate a decision.
      if (facts.reads.size && !isLoop && !identicalBranches(info, node.id)) {
        features[index].add("decision");
        const kind =
          "controlFlow" in node.data.config
            ? node.data.config.controlFlow?.kind
            : undefined;
        if (kind === "switch" || kind === "switchCase")
          features[index].add("switch");
        scope.controls.push({ index, until: info.joins.get(node.id) });
      }
    }
    if (node.type === "functionCall" && "functionId" in node.data.config) {
      const config = node.data.config;
      features[index].add("function");
      const fn = program.functions.find((fn) => fn.id === config.functionId);
      if (!fn) continue;
      const local = new Map(scope.environment);
      const inherited = new Set(scope.environment.keys());
      fn.parameters.forEach((name, parameterIndex) => {
        const parameterDeps = new Set<number>([index]);
        for (const read of analyze(
          config.args[parameterIndex] ?? "",
          step.variablesBefore,
        ).reads)
          union(parameterDeps, scope.environment.get(read));
        local.set(name, parameterDeps);
        inherited.delete(name);
      });
      scopes.push({
        environment: local,
        controls: [],
        calls: [...scope.calls, index],
        inherited,
        assignTo: node.data.config.assignTo,
      });
      continue;
    }
    if (node.type === "return" || (node.type === "end" && scopes.length > 1)) {
      if (scopes.length > 1) {
        const returned = scopes.pop()!,
          caller = scopes[scopes.length - 1];
        for (const name of returned.inherited) {
          const provenance = returned.environment.get(name);
          if (provenance) caller.environment.set(name, provenance);
        }
        if (returned.assignTo)
          caller.environment.set(returned.assignTo, new Set([index]));
      }
      continue;
    }
    for (const name of facts.writes)
      scope.environment.set(name, new Set([index]));
    if (node.type === "output") outputs.push(index);
  }
  const relevant = new Set<number>();
  const pending = [...outputs];
  while (pending.length) {
    const index = pending.pop()!;
    if (relevant.has(index)) continue;
    relevant.add(index);
    for (const dependency of dependencies[index]) pending.push(dependency);
  }
  const dataRelevant = new Set<number>();
  const dataPending = [...outputs];
  while (dataPending.length) {
    const index = dataPending.pop()!;
    if (dataRelevant.has(index)) continue;
    dataRelevant.add(index);
    for (const dependency of dataDependencies[index])
      dataPending.push(dependency);
  }
  const demonstrated = new Set<ExerciseTechnique>();
  for (const index of relevant)
    for (const feature of features[index]) {
      // An accumulator must supply output data, not merely increment an unused
      // counter around a prewritten answer.
      if (feature !== "accumulator" || dataRelevant.has(index))
        demonstrated.add(feature);
    }
  const checks: TechniqueCheck[] = requirements.map((technique) => ({
    technique,
    passed: demonstrated.has(technique),
  }));
  return { passed: checks.every((check) => check.passed), checks };
}

function nodeFacts(node: FlowEditorNode, variables: ExecutionVariables): Facts {
  const config = node.data.config;
  if (node.type === "process" && "instruction" in config)
    return analyze(config.instruction, variables);
  if (node.type === "decision" && "condition" in config)
    return analyze(config.condition, variables);
  if (node.type === "output" && "expression" in config)
    return "outputMode" in config && config.outputMode === "text"
      ? emptyFacts()
      : analyze(config.expression, variables);
  if (node.type === "return" && "expression" in config)
    return analyze(config.expression.replace(/^return\s+/, ""), variables);
  if (node.type === "functionCall" && "args" in config)
    return analyze(config.args.join(", "), variables);
  if (node.type === "input" && "variableName" in config) {
    const facts = emptyFacts();
    facts.writes.add(config.variableName);
    facts.features.add("input");
    return facts;
  }
  return emptyFacts();
}
function emptyFacts(): Facts {
  return { reads: new Set(), writes: new Set(), features: new Set() };
}

type Ast = { type: string; [key: string]: unknown };
type AnalysisContext = { source: string; variables: ExecutionVariables };
function analyze(source: string, variables: ExecutionVariables = {}): Facts {
  const facts = emptyFacts();
  if (!source.trim()) return facts;
  try {
    const ast = parse(source, {
      sourceType: "module",
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
    });
    visit(ast as unknown as Ast, facts, { source, variables });
  } catch {
    /* Execution rejects invalid expressions separately. */
  }
  return facts;
}
function visit(node: Ast | undefined, facts: Facts, context: AnalysisContext) {
  const visitChild = (child: Ast | undefined, into: Facts) =>
    visit(child, into, context);
  if (!node) return;
  if (node.type === "Identifier") {
    facts.reads.add(String(node.name));
    return;
  }
  if (node.type === "VariableDeclarator") {
    addWrite(node.id as Ast, facts, context);
    visitChild(node.init as Ast, facts);
    return;
  }
  if (
    node.type === "AssignmentExpression" ||
    node.type === "UpdateExpression"
  ) {
    const left = (node.left ?? node.argument) as Ast;
    addWrite(left, facts, context);
    if (node.operator !== "=") {
      visitChild(left, facts);
      facts.features.add("accumulator");
    }
    if (node.type === "AssignmentExpression") {
      const rightFacts = emptyFacts();
      visitChild(node.right as Ast, rightFacts);
      merge(facts, rightFacts);
      const name = baseName(left);
      if (
        name &&
        rightFacts.reads.has(name) &&
        hasArithmetic(node.right as Ast)
      )
        facts.features.add("accumulator");
    }
    return;
  }
  if (
    node.type === "ConditionalExpression" ||
    node.type === "LogicalExpression"
  ) {
    const test = (node.test ?? node.left) as Ast;
    visitChild(test, facts);
    const evaluated = evaluateExpression(
      context.source.slice(Number(test.start), Number(test.end)),
      context.variables,
    );
    if (evaluated.ok) {
      if (node.type === "ConditionalExpression")
        visitChild(
          (evaluated.value ? node.consequent : node.alternate) as Ast,
          facts,
        );
      else if (
        node.operator === "&&"
          ? Boolean(evaluated.value)
          : node.operator === "||"
            ? !evaluated.value
            : evaluated.value === null || evaluated.value === undefined
      )
        visitChild(node.right as Ast, facts);
      return;
    }
  }
  if (node.type === "BinaryExpression" && node.operator === "%")
    facts.features.add("modulo");
  if (node.type === "ArrayExpression") facts.features.add("array");
  if (node.type === "ObjectExpression") facts.features.add("object");
  if (
    node.type === "OptionalMemberExpression" ||
    node.type === "OptionalCallExpression"
  )
    facts.features.add("optionalChaining");
  if (
    node.type === "MemberExpression" ||
    node.type === "OptionalMemberExpression"
  ) {
    visitChild(node.object as Ast, facts);
    if (node.computed) visitChild(node.property as Ast, facts);
    return;
  }
  if (node.type === "ObjectProperty") {
    if (node.computed) visitChild(node.key as Ast, facts);
    visitChild(node.value as Ast, facts);
    return;
  }
  if (
    node.type === "CallExpression" ||
    node.type === "OptionalCallExpression"
  ) {
    const callee = node.callee as Ast;
    if (
      callee?.type === "MemberExpression" ||
      callee?.type === "OptionalMemberExpression"
    ) {
      const property = callee.property as Ast;
      const method = callee.computed ? property?.value : property?.name;
      const receiverNode = callee.object as Ast;
      const receiver = evaluateExpression(
        context.source.slice(
          Number(receiverNode.start),
          Number(receiverNode.end),
        ),
        context.variables,
      );
      if (receiver.ok && Array.isArray(receiver.value)) {
        facts.features.add("array");
        if (
          [
            "push",
            "pop",
            "shift",
            "unshift",
            "splice",
            "sort",
            "reverse",
            "fill",
            "copyWithin",
          ].includes(String(method))
        ) {
          addWrite(receiverNode, facts, context);
          visitChild(receiverNode, facts);
        }
      }
      if (
        receiver.ok &&
        typeof receiver.value === "string" &&
        [
          "trim",
          "trimStart",
          "trimEnd",
          "toUpperCase",
          "toLowerCase",
          "substring",
          "slice",
          "replace",
          "replaceAll",
          "split",
          "charAt",
          "startsWith",
          "endsWith",
          "includes",
        ].includes(String(method))
      )
        facts.features.add("stringMethods");
      if (baseName(callee.object as Ast) === "Math") facts.features.add("math");
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (
      [
        "loc",
        "start",
        "end",
        "extra",
        "comments",
        "leadingComments",
        "trailingComments",
        "innerComments",
      ].includes(key)
    )
      continue;
    if (Array.isArray(value))
      for (const child of value) {
        if (isAst(child)) visitChild(child, facts);
      }
    else if (isAst(value)) visitChild(value, facts);
  }
}
function isAst(value: unknown): value is Ast {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      typeof value.type === "string",
  );
}
function addWrite(node: Ast, facts: Facts, context: AnalysisContext) {
  const name = baseName(node);
  if (name) facts.writes.add(name);
  if (node.type !== "Identifier") visit(node, facts, context);
}
function baseName(node: Ast | undefined): string | undefined {
  if (!node) return;
  if (node.type === "Identifier") return String(node.name);
  if (
    node.type === "MemberExpression" ||
    node.type === "OptionalMemberExpression"
  )
    return baseName(node.object as Ast);
}
function hasArithmetic(node: Ast): boolean {
  if (!node) return false;
  if (
    node.type === "BinaryExpression" &&
    ["+", "-", "*", "/", "%", "**"].includes(String(node.operator))
  )
    return true;
  return Object.values(node).some(
    (value) => isAst(value) && hasArithmetic(value),
  );
}
function merge(into: Facts, from: Facts) {
  for (const name of from.reads) into.reads.add(name);
  for (const name of from.writes) into.writes.add(name);
  for (const feature of from.features) into.features.add(feature);
}
function union(into: Set<number>, from: Set<number> | undefined) {
  if (from) for (const index of from) into.add(index);
}

function diagramInfo(diagram: FlowEditorDiagram): DiagramInfo {
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of diagram.edges) {
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  const info: DiagramInfo = {
    diagram,
    nodes,
    outgoing,
    loops: new Map(),
    joins: new Map(),
  };
  // A decision inside a loop is not itself a loop header merely because it can
  // reach itself through the outer loop. DFS back edges identify the actual
  // repetition boundary, including a do-while condition at the body's end.
  const colors = new Map<string, number>();
  const conditions = new Set<string>();
  const walk = (id: string) => {
    colors.set(id, 1);
    for (const target of outgoing.get(id) ?? []) {
      if (!colors.has(target)) walk(target);
      else if (colors.get(target) === 1) {
        const sourceNode = nodes.get(id);
        const targetNode = nodes.get(target);
        const doWhile =
          sourceNode?.type === "decision" &&
          "controlFlow" in sourceNode.data.config &&
          sourceNode.data.config.controlFlow?.kind === "doWhile";
        if (doWhile) conditions.add(id);
        else if (targetNode?.type === "decision") conditions.add(target);
        else if (sourceNode?.type === "decision") conditions.add(id);
      }
    }
    colors.set(id, 2);
  };
  const start = diagram.nodes.find((node) => node.type === "start");
  if (start) walk(start.id);
  for (const node of diagram.nodes) if (!colors.has(node.id)) walk(node.id);
  for (const node of diagram.nodes) {
    if (node.type !== "decision") continue;
    const targets = outgoing.get(node.id) ?? [];
    const body = targets.find((target) => reachable(info, target, node.id));
    if (body && conditions.has(node.id)) {
      const members = new Set<string>([node.id]);
      for (const id of distances(info, body, new Set([node.id])).keys())
        if (reachable(info, id, node.id)) members.add(id);
      info.loops.set(node.id, members);
    } else if (targets.length > 1) {
      const branches = targets.map((target) =>
        distances(info, target, new Set([node.id])),
      );
      const common = [...branches[0].keys()].filter((id) =>
        branches.every((branch) => branch.has(id)),
      );
      common.sort(
        (a, b) =>
          Math.max(...branches.map((branch) => branch.get(a)!)) -
          Math.max(...branches.map((branch) => branch.get(b)!)),
      );
      info.joins.set(node.id, common[0]);
    }
  }
  return info;
}
function distances(info: DiagramInfo, start: string, stop = new Set<string>()) {
  const found = new Map<string, number>(),
    queue: Array<[string, number]> = [[start, 0]];
  while (queue.length) {
    const [id, distance] = queue.shift()!;
    if (found.has(id) || stop.has(id)) continue;
    found.set(id, distance);
    for (const next of info.outgoing.get(id) ?? [])
      queue.push([next, distance + 1]);
  }
  return found;
}
function reachable(info: DiagramInfo, start: string, target: string) {
  return distances(info, start).has(target);
}
function identicalBranches(info: DiagramInfo, id: string) {
  const targets = info.outgoing.get(id) ?? [];
  if (targets.length !== 2) return false;
  const until = info.joins.get(id);
  const signature = (start: string) => {
    const steps: string[] = [],
      seen = new Set<string>();
    let current: string | undefined = start;
    while (
      current &&
      current !== until &&
      !seen.has(current) &&
      steps.length < 100
    ) {
      seen.add(current);
      const node = info.nodes.get(current);
      if (!node) return "unknown";
      if (node.type === "decision" || node.type === "functionCall")
        return `complex:${current}`;
      if (node.type !== "start" && node.type !== "end")
        steps.push(JSON.stringify([node.type, node.data.config]));
      const next: string[] = info.outgoing.get(current) ?? [];
      if (next.length > 1) return `complex:${current}`;
      current = next[0];
    }
    return JSON.stringify(steps);
  };
  return signature(targets[0]) === signature(targets[1]);
}
