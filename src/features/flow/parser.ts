import { parse } from "@babel/parser";
import type { XYPosition } from "@xyflow/react";
import type {
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  ExpressionStatement,
  File,
  FunctionDeclaration,
  IfStatement,
  LogicalExpression,
  MemberExpression,
  OptionalCallExpression,
  OptionalMemberExpression,
  ReturnStatement,
  Statement,
  UnaryExpression,
  UpdateExpression,
  VariableDeclaration,
  VariableDeclarator,
  WhileStatement,
} from "@babel/types";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import type {
  FlowEditorEdge,
  FlowFunctionDefinition,
  FlowNode,
  FlowNodeDataByType,
  FlowNodeType,
} from "@/types/flow";

export type ImportedFlowNode = FlowNode & {
  position: XYPosition;
};

export type ImportedFlowFunctionDefinition = Omit<
  FlowFunctionDefinition,
  "nodes"
> & {
  nodes: ImportedFlowNode[];
};

export type JavaScriptImportResult =
  | {
      ok: true;
      nodes: ImportedFlowNode[];
      edges: FlowEditorEdge[];
      functions: ImportedFlowFunctionDefinition[];
      warnings: string[];
    }
  | {
      ok: false;
      message: string;
    };

type PendingConnection = {
  sourceId: string;
  sourceHandle: string;
};

type BuildResult = {
  entryId?: string;
  pending: PendingConnection[];
};

type DiagramBuilder = {
  nodes: ImportedFlowNode[];
  edges: FlowEditorEdge[];
  warnings: string[];
  functionsByName: Map<string, ImportedFlowFunctionDefinition>;
  nextId: number;
  nextRow: number;
};

type KnownFunctionCall = {
  flowFunction: ImportedFlowFunctionDefinition;
  args: string[];
  argsText: string;
};

type ImportedInputCall = Omit<
  FlowNodeDataByType["input"]["config"],
  "variableName"
>;

type ImportPlan = {
  functionDeclarations: FunctionDeclaration[];
  mainStatements: Statement[];
};

const columnWidth = 260;
const rowHeight = 150;
const originX = 360;
const originY = 60;

export function importJavaScriptToFlow(code: string): JavaScriptImportResult {
  try {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      return {
        ok: false,
        message: "Pega código JavaScript antes de generar el diagrama.",
      };
    }

    const ast = parseJavaScript(trimmedCode);
    const importPlan = createImportPlan(ast.program.body);
    const warnings: string[] = [];
    const functionsByName = createFunctionDefinitions(
      importPlan.functionDeclarations,
      warnings,
    );

    for (const functionDeclaration of importPlan.functionDeclarations) {
      buildFunctionDefinition(
        functionDeclaration,
        functionsByName,
        warnings,
      );
    }

    const builder = createDiagramBuilder(functionsByName, warnings);
    const startNode = addNode(builder, "start", "Inicio", {}, 0);
    const bodyResult = buildStatementSequence(
      importPlan.mainStatements,
      builder,
      0,
    );
    const endNode = addNode(builder, "end", "Fin", {}, 0);

    if (bodyResult.entryId) {
      addEdge(builder, startNode.id, bodyResult.entryId, "out");
      connectPendingToTarget(builder, bodyResult.pending, endNode.id);
    } else {
      addEdge(builder, startNode.id, endNode.id, "out");
      builder.warnings.push(
        "El programa no contiene instrucciones; se generó Inicio y Fin.",
      );
    }

    return {
      ok: true,
      nodes: builder.nodes,
      edges: builder.edges,
      functions: Array.from(functionsByName.values()),
      warnings: builder.warnings,
    };
  } catch (error) {
    if (error instanceof UnsupportedSyntaxError) {
      return {
        ok: false,
        message: error.message,
      };
    }

    if (error instanceof Error) {
      return {
        ok: false,
        message: `No se pudo parsear el código. Revisa la sintaxis: ${error.message}`,
      };
    }

    return {
      ok: false,
      message: "No se pudo parsear el código por un error desconocido.",
    };
  }
}

function parseJavaScript(code: string): File {
  return parse(code, {
    sourceType: "unambiguous",
    errorRecovery: false,
  });
}

function createImportPlan(statements: Statement[]): ImportPlan {
  const functionDeclarations = statements.filter(isFunctionDeclaration);
  const mainFunction = functionDeclarations.find(
    (functionDeclaration) =>
      functionDeclaration.id?.name === "main" &&
      functionDeclaration.params.length === 0,
  );
  const importedFunctionDeclarations = functionDeclarations.filter(
    (functionDeclaration) =>
      functionDeclaration !== mainFunction &&
      !isGeneratedInputHelper(functionDeclaration),
  );
  const topLevelStatements = statements.filter(
    (statement) => statement.type !== "FunctionDeclaration",
  );

  if (
    mainFunction &&
    topLevelStatements.length === 1 &&
    isIdentifierCallStatement(topLevelStatements[0], "main")
  ) {
    return {
      functionDeclarations: importedFunctionDeclarations,
      mainStatements: mainFunction.body.body,
    };
  }

  return {
    functionDeclarations: importedFunctionDeclarations,
    mainStatements: topLevelStatements,
  };
}

function isFunctionDeclaration(
  statement: Statement,
): statement is FunctionDeclaration {
  return statement.type === "FunctionDeclaration";
}

function isIdentifierCallStatement(statement: Statement, name: string) {
  return (
    statement.type === "ExpressionStatement" &&
    statement.expression.type === "CallExpression" &&
    statement.expression.callee.type === "Identifier" &&
    statement.expression.callee.name === name &&
    statement.expression.arguments.length === 0
  );
}

function isGeneratedInputHelper(functionDeclaration: FunctionDeclaration) {
  return (
    functionDeclaration.id?.name === "leerEntrada" &&
    functionDeclaration.params.length === 2 &&
    isIdentifierParameter(functionDeclaration.params[0], "mensaje") &&
    isDefaultStringParameter(functionDeclaration.params[1], "tipo", "text")
  );
}

function isIdentifierParameter(
  parameter: FunctionDeclaration["params"][number],
  name: string,
) {
  return parameter.type === "Identifier" && parameter.name === name;
}

function isDefaultStringParameter(
  parameter: FunctionDeclaration["params"][number],
  name: string,
  value: string,
) {
  return (
    parameter.type === "AssignmentPattern" &&
    parameter.left.type === "Identifier" &&
    parameter.left.name === name &&
    parameter.right.type === "StringLiteral" &&
    parameter.right.value === value
  );
}

function createFunctionDefinitions(
  functionDeclarations: FunctionDeclaration[],
  warnings: string[],
) {
  const functionsByName = new Map<string, ImportedFlowFunctionDefinition>();
  const usedIds = new Set<string>();

  for (const functionDeclaration of functionDeclarations) {
    const name = functionDeclaration.id?.name;

    if (!name) {
      warnings.push("Se omitio una funcion sin nombre durante la importacion.");
      continue;
    }

    if (functionsByName.has(name)) {
      warnings.push(
        `La funcion "${name}" esta duplicada; se importo la primera.`,
      );
      continue;
    }

    functionsByName.set(name, {
      id: createFunctionId(name, usedIds),
      name,
      parameters: functionDeclaration.params.map(functionParameterToCode),
      nodes: [],
      edges: [],
    });
  }

  return functionsByName;
}

function buildFunctionDefinition(
  functionDeclaration: FunctionDeclaration,
  functionsByName: Map<string, ImportedFlowFunctionDefinition>,
  warnings: string[],
) {
  const name = functionDeclaration.id?.name;
  const flowFunction = name ? functionsByName.get(name) : undefined;

  if (!flowFunction) {
    return;
  }

  const builder = createDiagramBuilder(functionsByName, warnings);
  const startNode = addNode(builder, "start", "Inicio", {}, 0);
  const bodyResult = buildStatementSequence(
    functionDeclaration.body.body,
    builder,
    0,
  );

  if (bodyResult.entryId) {
    addEdge(builder, startNode.id, bodyResult.entryId, "out");

    if (bodyResult.pending.length > 0) {
      const endNode = addNode(builder, "end", "Fin", {}, 0);
      connectPendingToTarget(builder, bodyResult.pending, endNode.id);
    }
  } else {
    const endNode = addNode(builder, "end", "Fin", {}, 0);
    addEdge(builder, startNode.id, endNode.id, "out");
    warnings.push(
      `La funcion "${name}" no contiene instrucciones; se genero Inicio y Fin.`,
    );
  }

  flowFunction.nodes = builder.nodes;
  flowFunction.edges = builder.edges;
}

function buildStatementSequence(
  statements: Statement[],
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  let entryId: string | undefined;
  let pending: PendingConnection[] = [];

  for (const statement of statements) {
    const statementResult = buildStatement(statement, builder, column);

    if (!statementResult.entryId) {
      continue;
    }

    if (!entryId) {
      entryId = statementResult.entryId;
    }

    connectPendingToTarget(builder, pending, statementResult.entryId);
    pending = statementResult.pending;
  }

  return {
    entryId,
    pending,
  };
}

function buildStatement(
  statement: Statement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  if (statement.type === "VariableDeclaration") {
    return buildVariableDeclaration(statement, builder, column);
  }

  if (statement.type === "ExpressionStatement") {
    return buildExpressionStatement(statement, builder, column);
  }

  if (statement.type === "IfStatement") {
    return buildIfStatement(statement, builder, column);
  }

  if (statement.type === "WhileStatement") {
    return buildWhileStatement(statement, builder, column);
  }

  if (statement.type === "ReturnStatement") {
    return buildReturnStatement(statement, builder, column);
  }

  if (statement.type === "BlockStatement") {
    return buildStatementSequence(statement.body, builder, column);
  }

  if (statement.type === "EmptyStatement") {
    return {
      pending: [],
    };
  }

  throw new UnsupportedSyntaxError(
    `La instrucción "${statement.type}" todavía no está soportada. Usa declaraciones, asignaciones, if/else o while.`,
  );
}

function buildVariableDeclaration(
  statement: VariableDeclaration,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  let entryId: string | undefined;
  let pending: PendingConnection[] = [];

  for (const declaration of statement.declarations) {
    const variableName = lValueToCode(declaration.id);

    if (declaration.init) {
      const inputCall = getGeneratedInputCall(declaration.init);

      if (inputCall) {
        const inputNode = addInputNode(
          builder,
          variableName,
          inputCall,
          column,
        );

        if (!entryId) {
          entryId = inputNode.id;
        }

        connectPendingToTarget(builder, pending, inputNode.id);
        pending = [{ sourceId: inputNode.id, sourceHandle: "out" }];
        continue;
      }

      const knownCall = getKnownFunctionCall(declaration.init, builder);

      if (knownCall) {
        const declarationInstruction = createDeferredDeclarationInstruction(
          statement.kind,
          variableName,
        );
        const declarationNode = addNode(
          builder,
          "process",
          declarationInstruction,
          { instruction: declarationInstruction },
          column,
        );
        const functionCallNode = addFunctionCallNode(
          builder,
          knownCall,
          variableName,
          column,
        );

        if (!entryId) {
          entryId = declarationNode.id;
        }

        connectPendingToTarget(builder, pending, declarationNode.id);
        addEdge(builder, declarationNode.id, functionCallNode.id, "out");
        pending = [{ sourceId: functionCallNode.id, sourceHandle: "out" }];
        continue;
      }
    }

    const instruction = declaration.init
      ? `${statement.kind} ${variableName} = ${expressionToCode(
          declaration.init,
        )}`
      : `${statement.kind} ${variableName}`;
    const processNode = addNode(
      builder,
      "process",
      instruction,
      { instruction },
      column,
    );

    if (!entryId) {
      entryId = processNode.id;
    }

    connectPendingToTarget(builder, pending, processNode.id);
    pending = [{ sourceId: processNode.id, sourceHandle: "out" }];
  }

  return {
    entryId,
    pending,
  };
}

function createDeferredDeclarationInstruction(
  declarationKind: VariableDeclaration["kind"],
  variableName: string,
) {
  return `${declarationKind === "var" ? "var" : "let"} ${variableName}`;
}

function addInputNode(
  builder: DiagramBuilder,
  variableName: string,
  inputCall: ImportedInputCall,
  column: number,
) {
  return addNode(
    builder,
    "input",
    `Leer ${variableName || "variable"}`,
    {
      prompt: inputCall.prompt,
      variableName,
      inputType: inputCall.inputType,
    },
    column,
  );
}

function addOutputNode(
  builder: DiagramBuilder,
  outputConfig: FlowNodeDataByType["output"]["config"],
  column: number,
) {
  return addNode(
    builder,
    "output",
    `Mostrar ${outputConfig.expression || "salida"}`,
    outputConfig,
    column,
  );
}

function buildExpressionStatement(
  statement: ExpressionStatement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const expression = statement.expression;

  if (
    expression.type === "AssignmentExpression" &&
    expression.operator === "="
  ) {
    const inputCall = getGeneratedInputCall(expression.right);

    if (inputCall) {
      const inputNode = addInputNode(
        builder,
        lValueToCode(expression.left),
        inputCall,
        column,
      );

      return {
        entryId: inputNode.id,
        pending: [{ sourceId: inputNode.id, sourceHandle: "out" }],
      };
    }
  }

  const outputCall = getConsoleLogCall(expression);

  if (outputCall) {
    const outputNode = addOutputNode(builder, outputCall, column);

    return {
      entryId: outputNode.id,
      pending: [{ sourceId: outputNode.id, sourceHandle: "out" }],
    };
  }

  const knownCall = getKnownFunctionCall(expression, builder);

  if (knownCall) {
    const functionCallNode = addFunctionCallNode(
      builder,
      knownCall,
      "",
      column,
    );

    return {
      entryId: functionCallNode.id,
      pending: [{ sourceId: functionCallNode.id, sourceHandle: "out" }],
    };
  }

  if (
    expression.type === "AssignmentExpression" &&
    expression.operator === "="
  ) {
    const assignedKnownCall = getKnownFunctionCall(expression.right, builder);

    if (assignedKnownCall) {
      const functionCallNode = addFunctionCallNode(
        builder,
        assignedKnownCall,
        lValueToCode(expression.left),
        column,
      );

      return {
        entryId: functionCallNode.id,
        pending: [{ sourceId: functionCallNode.id, sourceHandle: "out" }],
      };
    }
  }

  if (
    expression.type !== "AssignmentExpression" &&
    expression.type !== "UpdateExpression" &&
    expression.type !== "CallExpression"
  ) {
    throw new UnsupportedSyntaxError(
      `La expresión "${expression.type}" todavía no está soportada como bloque de proceso.`,
    );
  }

  const instruction = expressionToCode(expression);
  const processNode = addNode(
    builder,
    "process",
    instruction,
    { instruction },
    column,
  );

  return {
    entryId: processNode.id,
    pending: [{ sourceId: processNode.id, sourceHandle: "out" }],
  };
}

function buildReturnStatement(
  statement: ReturnStatement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const expression = statement.argument
    ? expressionToCode(statement.argument)
    : "";
  const returnNode = addNode(
    builder,
    "return",
    `Retornar ${expression || "valor"}`,
    { expression },
    column,
  );

  return {
    entryId: returnNode.id,
    pending: [],
  };
}

function addFunctionCallNode(
  builder: DiagramBuilder,
  knownCall: KnownFunctionCall,
  assignTo: string,
  column: number,
) {
  return addNode(
    builder,
    "functionCall",
    `Llamar ${knownCall.flowFunction.name}`,
    {
      functionId: knownCall.flowFunction.id,
      args: knownCall.args,
      argsText: knownCall.argsText,
      assignTo,
    },
    column,
  );
}

function getKnownFunctionCall(
  expression: Expression,
  builder: DiagramBuilder,
): KnownFunctionCall | null {
  const callExpression = getCallExpression(expression);

  if (
    !callExpression ||
    callExpression.callee.type !== "Identifier"
  ) {
    return null;
  }

  const flowFunction = builder.functionsByName.get(callExpression.callee.name);

  if (!flowFunction) {
    return null;
  }

  const args = callExpression.arguments.map(argumentToCode);

  return {
    flowFunction,
    args,
    argsText: args.join(", "),
  };
}

function getGeneratedInputCall(expression: Expression): ImportedInputCall | null {
  const callExpression = getCallExpression(expression);

  if (
    !callExpression ||
    callExpression.callee.type !== "Identifier" ||
    callExpression.callee.name !== "leerEntrada"
  ) {
    return null;
  }

  return {
    prompt: getInputPrompt(callExpression.arguments[0]),
    inputType: getInputType(callExpression.arguments[1]),
  };
}

function getConsoleLogCall(
  expression: Expression,
): FlowNodeDataByType["output"]["config"] | null {
  const callExpression = getCallExpression(expression);

  if (
    !callExpression ||
    !isConsoleLogCallee(callExpression.callee) ||
    callExpression.arguments.length === 0
  ) {
    return null;
  }

  const outputArgument = callExpression.arguments[0];

  if (outputArgument.type === "SpreadElement") {
    throw new UnsupportedSyntaxError(
      "console.log con argumentos spread todavia no esta soportado.",
    );
  }

  if (outputArgument.type === "ArgumentPlaceholder") {
    throw new UnsupportedSyntaxError(
      "console.log con argumentos vacios todavia no esta soportado.",
    );
  }

  if (outputArgument.type === "StringLiteral") {
    return {
      expression: outputArgument.value,
      outputMode: "text",
    };
  }

  return {
    expression: expressionToCode(outputArgument),
    outputMode: "expression",
  };
}

function getCallExpression(expression: Expression): CallExpression | null {
  const unwrappedExpression = unwrapGeneratedExpression(expression);

  return unwrappedExpression.type === "CallExpression"
    ? unwrappedExpression
    : null;
}

function unwrapGeneratedExpression(expression: Expression): Expression {
  if (expression.type === "AwaitExpression") {
    return unwrapGeneratedExpression(expression.argument);
  }

  if (expression.type === "ParenthesizedExpression") {
    return unwrapGeneratedExpression(expression.expression);
  }

  return expression;
}

function getInputPrompt(
  argument: CallExpression["arguments"][number] | undefined,
) {
  if (!argument) {
    return "Ingresa un valor";
  }

  if (argument.type === "StringLiteral") {
    return argument.value;
  }

  return argumentToCode(argument);
}

function getInputType(
  argument: CallExpression["arguments"][number] | undefined,
): ImportedInputCall["inputType"] {
  if (!argument || argument.type !== "StringLiteral") {
    return "text";
  }

  if (
    argument.value === "number" ||
    argument.value === "boolean" ||
    argument.value === "text"
  ) {
    return argument.value;
  }

  return "text";
}

function isConsoleLogCallee(callee: CallExpression["callee"]) {
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "console" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "log" &&
    !callee.computed
  );
}

function buildIfStatement(
  statement: IfStatement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const condition = expressionToCode(statement.test);
  const decisionNode = addNode(
    builder,
    "decision",
    condition,
    { condition },
    column,
  );
  const yesResult = buildStatementSequence(
    getStatementsFromBranch(statement.consequent),
    builder,
    column - 1,
  );
  const noResult = statement.alternate
    ? buildStatementSequence(
        getStatementsFromBranch(statement.alternate),
        builder,
        column + 1,
      )
    : {
        pending: [] satisfies PendingConnection[],
      };
  const pending: PendingConnection[] = [];

  if (yesResult.entryId) {
    addEdge(builder, decisionNode.id, yesResult.entryId, "yes");
    pending.push(...yesResult.pending);
  } else {
    pending.push({ sourceId: decisionNode.id, sourceHandle: "yes" });
  }

  if (noResult.entryId) {
    addEdge(builder, decisionNode.id, noResult.entryId, "no");
    pending.push(...noResult.pending);
  } else {
    pending.push({ sourceId: decisionNode.id, sourceHandle: "no" });
  }

  return {
    entryId: decisionNode.id,
    pending,
  };
}

function buildWhileStatement(
  statement: WhileStatement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const condition = expressionToCode(statement.test);
  const decisionNode = addNode(
    builder,
    "decision",
    condition,
    { condition },
    column,
  );
  const bodyResult = buildStatementSequence(
    getStatementsFromBranch(statement.body),
    builder,
    column - 1,
  );

  if (bodyResult.entryId) {
    addEdge(builder, decisionNode.id, bodyResult.entryId, "yes");
    connectPendingToTarget(builder, bodyResult.pending, decisionNode.id);
  } else {
    addEdge(builder, decisionNode.id, decisionNode.id, "yes");
    builder.warnings.push(
      `El ciclo while (${condition}) no tiene instrucciones en su cuerpo.`,
    );
  }

  return {
    entryId: decisionNode.id,
    pending: [{ sourceId: decisionNode.id, sourceHandle: "no" }],
  };
}

function getStatementsFromBranch(statement: Statement): Statement[] {
  if (statement.type === "BlockStatement") {
    return statement.body;
  }

  return [statement];
}

function connectPendingToTarget(
  builder: DiagramBuilder,
  pendingConnections: PendingConnection[],
  targetId: string,
) {
  for (const pendingConnection of pendingConnections) {
    addEdge(
      builder,
      pendingConnection.sourceId,
      targetId,
      pendingConnection.sourceHandle,
    );
  }
}

function addNode<TType extends FlowNodeType>(
  builder: DiagramBuilder,
  type: TType,
  label: string,
  config: FlowNodeDataByType[TType]["config"],
  column: number,
): Extract<ImportedFlowNode, { type: TType }> {
  builder.nextId += 1;

  const node = {
    id: `import-${type}-${builder.nextId}`,
    type,
    position: getNodePosition(builder.nextRow, column),
    data: {
      label,
      config,
    },
  } as Extract<ImportedFlowNode, { type: TType }>;

  builder.nextRow += 1;
  builder.nodes.push(node);

  return node;
}

function addEdge(
  builder: DiagramBuilder,
  source: string,
  target: string,
  sourceHandle: string,
) {
  builder.edges.push(
    createFlowEditorEdge({
      source,
      target,
      sourceHandle,
      targetHandle: "in",
    }),
  );
}

function expressionToCode(expression: Expression): string {
  if (expression.type === "Identifier") {
    return expression.name;
  }

  if (expression.type === "NumericLiteral") {
    return String(expression.value);
  }

  if (expression.type === "StringLiteral") {
    return JSON.stringify(expression.value);
  }

  if (expression.type === "BooleanLiteral") {
    return String(expression.value);
  }

  if (expression.type === "NullLiteral") {
    return "null";
  }

  if (expression.type === "BinaryExpression") {
    return binaryExpressionToCode(expression);
  }

  if (expression.type === "LogicalExpression") {
    return logicalExpressionToCode(expression);
  }

  if (expression.type === "UnaryExpression") {
    return unaryExpressionToCode(expression);
  }

  if (expression.type === "AssignmentExpression") {
    return assignmentExpressionToCode(expression);
  }

  if (expression.type === "UpdateExpression") {
    return updateExpressionToCode(expression);
  }

  if (expression.type === "MemberExpression") {
    return memberExpressionToCode(expression);
  }

  if (expression.type === "OptionalMemberExpression") {
    return optionalMemberExpressionToCode(expression);
  }

  if (expression.type === "CallExpression") {
    return callExpressionToCode(expression);
  }

  if (expression.type === "OptionalCallExpression") {
    return optionalCallExpressionToCode(expression);
  }

  if (expression.type === "AwaitExpression") {
    return `await ${expressionToCode(expression.argument)}`;
  }

  if (expression.type === "ParenthesizedExpression") {
    return `(${expressionToCode(expression.expression)})`;
  }

  throw new UnsupportedSyntaxError(
    `La expresión "${expression.type}" todavía no está soportada.`,
  );
}

function binaryExpressionToCode(expression: BinaryExpression) {
  return `${binaryExpressionSideToCode(expression.left)} ${
    expression.operator
  } ${expressionToCode(expression.right)}`;
}

function logicalExpressionToCode(expression: LogicalExpression) {
  return `${expressionToCode(expression.left)} ${
    expression.operator
  } ${expressionToCode(expression.right)}`;
}

function unaryExpressionToCode(expression: UnaryExpression) {
  const argument = expressionToCode(expression.argument);

  return expression.operator.length > 1
    ? `${expression.operator} ${argument}`
    : `${expression.operator}${argument}`;
}

function assignmentExpressionToCode(expression: AssignmentExpression) {
  return `${lValueToCode(expression.left)} ${expression.operator} ${expressionToCode(
    expression.right,
  )}`;
}

function updateExpressionToCode(expression: UpdateExpression) {
  const argument = expressionToCode(expression.argument);

  return expression.prefix
    ? `${expression.operator}${argument}`
    : `${argument}${expression.operator}`;
}

function memberExpressionToCode(expression: MemberExpression) {
  const object = expressionObjectToCode(expression.object);
  const property =
    expression.property.type === "PrivateName"
      ? `#${expression.property.id.name}`
      : expressionToCode(expression.property);

  return expression.computed ? `${object}[${property}]` : `${object}.${property}`;
}

function optionalMemberExpressionToCode(expression: OptionalMemberExpression) {
  const object = expressionToCode(expression.object);
  const property = expressionToCode(expression.property);

  return expression.computed
    ? `${object}?.[${property}]`
    : `${object}?.${property}`;
}

function callExpressionToCode(expression: CallExpression) {
  const callee = calleeToCode(expression.callee);

  return `${callee}(${expression.arguments.map(argumentToCode).join(", ")})`;
}

function optionalCallExpressionToCode(expression: OptionalCallExpression) {
  const callee = calleeToCode(expression.callee);

  return `${callee}?.(${expression.arguments.map(argumentToCode).join(", ")})`;
}

function argumentToCode(
  argument:
    | CallExpression["arguments"][number]
    | OptionalCallExpression["arguments"][number],
) {
  if (argument.type === "SpreadElement") {
    return `...${expressionToCode(argument.argument)}`;
  }

  if (argument.type === "ArgumentPlaceholder") {
    throw new UnsupportedSyntaxError(
      "Los argumentos vacíos todavía no están soportados.",
    );
  }

  return expressionToCode(argument);
}

function lValueToCode(
  value: AssignmentExpression["left"] | VariableDeclarator["id"],
) {
  if (value.type === "Identifier") {
    return value.name;
  }

  if (value.type === "MemberExpression") {
    return memberExpressionToCode(value);
  }

  if (value.type === "OptionalMemberExpression") {
    return optionalMemberExpressionToCode(value);
  }

  throw new UnsupportedSyntaxError(
    `El lado izquierdo "${value.type}" todavía no está soportado.`,
  );
}

function binaryExpressionSideToCode(value: BinaryExpression["left"]) {
  if (value.type === "PrivateName") {
    return `#${value.id.name}`;
  }

  return expressionToCode(value);
}

function expressionObjectToCode(value: MemberExpression["object"]) {
  if (value.type === "Super") {
    return "super";
  }

  return expressionToCode(value);
}

function calleeToCode(
  callee: CallExpression["callee"] | OptionalCallExpression["callee"],
) {
  if (callee.type === "Super") {
    return "super";
  }

  if (callee.type === "V8IntrinsicIdentifier") {
    throw new UnsupportedSyntaxError(
      "Las llamadas internas de V8 no están soportadas.",
    );
  }

  return expressionToCode(callee);
}

function createDiagramBuilder(
  functionsByName: Map<string, ImportedFlowFunctionDefinition> = new Map(),
  warnings: string[] = [],
): DiagramBuilder {
  return {
    nodes: [],
    edges: [],
    warnings,
    functionsByName,
    nextId: 0,
    nextRow: 0,
  };
}

function functionParameterToCode(
  parameter: FunctionDeclaration["params"][number],
) {
  if (parameter.type === "Identifier") {
    return parameter.name;
  }

  throw new UnsupportedSyntaxError(
    `El parametro "${parameter.type}" todavia no esta soportado.`,
  );
}

function createFunctionId(name: string, usedIds: Set<string>) {
  const baseId = `import-function-${toSafeImportId(name)}`;
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);

  return id;
}

function toSafeImportId(value: string) {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "funcion"
  );
}

function getNodePosition(row: number, column: number): XYPosition {
  return {
    x: originX + column * columnWidth,
    y: originY + row * rowHeight,
  };
}

class UnsupportedSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedSyntaxError";
  }
}
