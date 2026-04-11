import { parse } from "@babel/parser";
import type { XYPosition } from "@xyflow/react";
import type {
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  ExpressionStatement,
  File,
  IfStatement,
  LogicalExpression,
  MemberExpression,
  OptionalCallExpression,
  OptionalMemberExpression,
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
  FlowNode,
  FlowNodeDataByType,
  FlowNodeType,
} from "@/types/flow";

export type ImportedFlowNode = FlowNode & {
  position: XYPosition;
};

export type JavaScriptImportResult =
  | {
      ok: true;
      nodes: ImportedFlowNode[];
      edges: FlowEditorEdge[];
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
  nextId: number;
  nextRow: number;
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
    const builder = createDiagramBuilder();
    const startNode = addNode(builder, "start", "Inicio", {}, 0);
    const bodyResult = buildStatementSequence(
      ast.program.body,
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

function buildExpressionStatement(
  statement: ExpressionStatement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const expression = statement.expression;

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

function createDiagramBuilder(): DiagramBuilder {
  return {
    nodes: [],
    edges: [],
    warnings: [],
    nextId: 0,
    nextRow: 0,
  };
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
