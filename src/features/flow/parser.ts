import { parse } from "@babel/parser";
import type { XYPosition } from "@xyflow/react";
import type {
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  DoWhileStatement,
  Expression,
  ExpressionStatement,
  File,
  ForStatement,
  FunctionDeclaration,
  IfStatement,
  LogicalExpression,
  MemberExpression,
  ObjectProperty,
  OptionalCallExpression,
  OptionalMemberExpression,
  ReturnStatement,
  SequenceExpression,
  Statement,
  SwitchCase,
  SwitchStatement,
  TemplateLiteral,
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
  FlowFunctionParameterDefinition,
  FlowNode,
  FlowNodeDataByType,
  FlowPendingConnectionReference,
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
  breaks: PendingConnection[];
  continues: PendingConnection[];
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

    const parameterDefinitions = functionDeclaration.params.map(
      functionParameterToDefinition,
    );

    functionsByName.set(name, {
      id: createFunctionId(name, usedIds),
      name,
      parameters: parameterDefinitions.map((parameter) => parameter.source),
      parameterDefinitions,
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
  const breaks: PendingConnection[] = [];
  const continues: PendingConnection[] = [];

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
    breaks.push(...statementResult.breaks);
    continues.push(...statementResult.continues);
  }

  return {
    entryId,
    pending,
    breaks,
    continues,
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

  if (statement.type === "ForStatement") {
    return buildForStatement(statement, builder, column);
  }

  if (statement.type === "DoWhileStatement") {
    return buildDoWhileStatement(statement, builder, column);
  }

  if (statement.type === "SwitchStatement") {
    return buildSwitchStatement(statement, builder, column);
  }

  if (statement.type === "BreakStatement") {
    if (statement.label) {
      throw new UnsupportedSyntaxError(
        "break con etiqueta todavia no esta soportado.",
      );
    }

    return buildControlTransferStatement("break", builder, column);
  }

  if (statement.type === "ContinueStatement") {
    if (statement.label) {
      throw new UnsupportedSyntaxError(
        "continue con etiqueta todavia no esta soportado.",
      );
    }

    return buildControlTransferStatement("continue", builder, column);
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
      breaks: [],
      continues: [],
    };
  }

  throw new UnsupportedSyntaxError(
    `La instruccion "${statement.type}" todavia no esta soportada. Usa declaraciones, asignaciones, if/else, while, for, do while o switch.`,
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
    breaks: [],
    continues: [],
  };
}

function createDeferredDeclarationInstruction(
  declarationKind: VariableDeclaration["kind"],
  variableName: string,
) {
  return `${declarationKind === "var" ? "var" : "let"} ${variableName}`;
}

function variableDeclarationToCode(statement: VariableDeclaration) {
  return `${statement.kind} ${statement.declarations
    .map((declaration) =>
      declaration.init
        ? `${lValueToCode(declaration.id)} = ${expressionToCode(
            declaration.init,
          )}`
        : lValueToCode(declaration.id),
    )
    .join(", ")}`;
}

function variableDeclaratorToInstruction(
  declarationKind: VariableDeclaration["kind"],
  declaration: VariableDeclarator,
) {
  const variableName = lValueToCode(declaration.id);

  return declaration.init
    ? `${declarationKind} ${variableName} = ${expressionToCode(
        declaration.init,
      )}`
    : `${declarationKind} ${variableName}`;
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
        breaks: [],
        continues: [],
      };
    }
  }

  const outputCall = getConsoleLogCall(expression);

  if (outputCall) {
    const outputNode = addOutputNode(builder, outputCall, column);

    return {
      entryId: outputNode.id,
      pending: [{ sourceId: outputNode.id, sourceHandle: "out" }],
      breaks: [],
      continues: [],
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
      breaks: [],
      continues: [],
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
        breaks: [],
        continues: [],
      };
    }
  }

  if (
    expression.type !== "AssignmentExpression" &&
    expression.type !== "UpdateExpression" &&
    expression.type !== "CallExpression" &&
    expression.type !== "OptionalCallExpression" &&
    expression.type !== "SequenceExpression"
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
    breaks: [],
    continues: [],
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
    breaks: [],
    continues: [],
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

  if (
    callExpression.arguments.some(
      (argument) =>
        argument.type === "SpreadElement" ||
        argument.type === "ArgumentPlaceholder",
    )
  ) {
    throw new UnsupportedSyntaxError(
      "Las llamadas a funciones del diagrama con spread o argumentos vacios todavia no estan soportadas.",
    );
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
        breaks: [] satisfies PendingConnection[],
        continues: [] satisfies PendingConnection[],
      };
  const pending: PendingConnection[] = [];
  const breaks: PendingConnection[] = [
    ...yesResult.breaks,
    ...noResult.breaks,
  ];
  const continues: PendingConnection[] = [
    ...yesResult.continues,
    ...noResult.continues,
  ];

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
    breaks,
    continues,
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
    connectPendingToTarget(builder, bodyResult.continues, decisionNode.id);
  } else {
    addEdge(builder, decisionNode.id, decisionNode.id, "yes");
    builder.warnings.push(
      `El ciclo while (${condition}) no tiene instrucciones en su cuerpo.`,
    );
  }

  return {
    entryId: decisionNode.id,
    pending: [
      { sourceId: decisionNode.id, sourceHandle: "no" },
      ...bodyResult.breaks,
    ],
    breaks: [],
    continues: [],
  };
}

function buildForStatement(
  statement: ForStatement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const initializer = buildForInitializer(statement.init, builder, column);
  const condition = statement.test ? expressionToCode(statement.test) : "true";
  const headerCondition = statement.test ? condition : null;
  const update = statement.update ? expressionToCode(statement.update) : "";
  const decisionNode = addNode(
    builder,
    "decision",
    condition,
    {
      condition,
      controlFlow: {
        kind: "for",
        init: initializer.code,
        test: headerCondition,
        update,
        initNodeIds: initializer.nodeIds,
      },
    },
    column,
  );
  const bodyResult = buildStatementSequence(
    getStatementsFromBranch(statement.body),
    builder,
    column - 1,
  );
  const updateNode = update
    ? addNode(
        builder,
        "process",
        update,
        {
          instruction: update,
          controlFlow: {
            kind: "forUpdate",
            loopDecisionId: decisionNode.id,
          },
        },
        column,
      )
    : null;
  const loopTargetId = updateNode?.id ?? decisionNode.id;

  setForInitMetadata(builder, initializer.nodeIds, decisionNode.id);
  setForDecisionMetadata(decisionNode, {
    init: initializer.code,
    test: headerCondition,
    update,
    initNodeIds: initializer.nodeIds,
    updateNodeId: updateNode?.id,
    bodyEntryId: bodyResult.entryId,
  });

  if (initializer.entryId) {
    connectPendingToTarget(builder, initializer.pending, decisionNode.id);
  }

  if (bodyResult.entryId) {
    addEdge(builder, decisionNode.id, bodyResult.entryId, "yes");
    connectPendingToTarget(builder, bodyResult.pending, loopTargetId);
    connectPendingToTarget(builder, bodyResult.continues, loopTargetId);
  } else {
    addEdge(builder, decisionNode.id, loopTargetId, "yes");
    builder.warnings.push(
      `El ciclo for (${condition}) no tiene instrucciones en su cuerpo.`,
    );
  }

  if (updateNode) {
    addEdge(builder, updateNode.id, decisionNode.id, "out");
  }

  return {
    entryId: initializer.entryId ?? decisionNode.id,
    pending: [
      { sourceId: decisionNode.id, sourceHandle: "no" },
      ...bodyResult.breaks,
    ],
    breaks: [],
    continues: [],
  };
}

function buildDoWhileStatement(
  statement: DoWhileStatement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const bodyResult = buildStatementSequence(
    getStatementsFromBranch(statement.body),
    builder,
    column - 1,
  );
  const condition = expressionToCode(statement.test);
  const decisionNode = addNode(
    builder,
    "decision",
    condition,
    {
      condition,
      controlFlow: {
        kind: "doWhile",
        bodyEntryId: bodyResult.entryId,
      },
    },
    column,
  );

  if (bodyResult.entryId) {
    connectPendingToTarget(builder, bodyResult.pending, decisionNode.id);
    connectPendingToTarget(builder, bodyResult.continues, decisionNode.id);
    addEdge(builder, decisionNode.id, bodyResult.entryId, "yes");
  } else {
    addEdge(builder, decisionNode.id, decisionNode.id, "yes");
    builder.warnings.push(
      `El ciclo do while (${condition}) no tiene instrucciones en su cuerpo.`,
    );
  }

  return {
    entryId: bodyResult.entryId ?? decisionNode.id,
    pending: [
      { sourceId: decisionNode.id, sourceHandle: "no" },
      ...bodyResult.breaks,
    ],
    breaks: [],
    continues: [],
  };
}

function buildSwitchStatement(
  statement: SwitchStatement,
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const discriminant = expressionToCode(statement.discriminant);
  const builtCases = statement.cases.map((switchCase) =>
    buildSwitchCase(switchCase, builder, column + 1),
  );
  const testCaseIndexes = builtCases
    .map((switchCase, index) => (switchCase.test === null ? null : index))
    .filter((index): index is number => index !== null);
  const defaultIndex = builtCases.findIndex(
    (switchCase) => switchCase.test === null,
  );
  const conditionNodes = testCaseIndexes.map((caseIndex) => {
    const test = builtCases[caseIndex].test ?? "true";

    return {
      caseIndex,
      node: addNode(
        builder,
        "decision",
        `${discriminant} === ${test}`,
        {
          condition: `${discriminant} === ${test}`,
        },
        column,
      ),
    };
  });
  const rootNode =
    conditionNodes[0]?.node ??
    addNode(
      builder,
      "decision",
      "true",
      {
        condition: "true",
      },
      column,
    );
  const exitSources: PendingConnection[] = [];
  const continues: PendingConnection[] = [];

  for (let index = 0; index < conditionNodes.length; index += 1) {
    const current = conditionNodes[index];
    const next = conditionNodes[index + 1];
    const yesTarget = findSwitchFallthroughEntry(
      builtCases,
      current.caseIndex,
    );

    if (yesTarget) {
      addEdge(builder, current.node.id, yesTarget, "yes");
    } else {
      exitSources.push({ sourceId: current.node.id, sourceHandle: "yes" });
    }

    if (next) {
      addEdge(builder, current.node.id, next.node.id, "no");
      continue;
    }

    const defaultTarget =
      defaultIndex >= 0
        ? findSwitchFallthroughEntry(builtCases, defaultIndex)
        : undefined;

    if (defaultTarget) {
      addEdge(builder, current.node.id, defaultTarget, "no");
    } else {
      exitSources.push({ sourceId: current.node.id, sourceHandle: "no" });
    }
  }

  if (conditionNodes.length === 0) {
    const defaultTarget =
      defaultIndex >= 0
        ? findSwitchFallthroughEntry(builtCases, defaultIndex)
        : undefined;

    if (defaultTarget) {
      addEdge(builder, rootNode.id, defaultTarget, "yes");
    } else {
      exitSources.push({ sourceId: rootNode.id, sourceHandle: "yes" });
    }
  }

  for (let index = 0; index < builtCases.length; index += 1) {
    const switchCase = builtCases[index];
    const nextCaseEntry = findSwitchFallthroughEntry(builtCases, index + 1);

    if (nextCaseEntry) {
      connectPendingToTarget(builder, switchCase.result.pending, nextCaseEntry);
    } else {
      exitSources.push(...switchCase.result.pending);
    }

    exitSources.push(...switchCase.result.breaks);
    continues.push(...switchCase.result.continues);
  }

  const caseDecisionIds = conditionNodes.map((item) => item.node.id);

  setDecisionSwitchMetadata(rootNode, {
    discriminant,
    cases: builtCases.map((switchCase) => ({
      test: switchCase.test,
      entryId: switchCase.result.entryId,
    })),
    caseDecisionIds,
    exitSources,
  });

  for (const item of conditionNodes.slice(1)) {
    const test = builtCases[item.caseIndex].test;

    if (test) {
      setDecisionSwitchCaseMetadata(item.node, rootNode.id, test);
    }
  }

  return {
    entryId: rootNode.id,
    pending: exitSources,
    breaks: [],
    continues,
  };
}

function buildControlTransferStatement(
  kind: "break" | "continue",
  builder: DiagramBuilder,
  column: number,
): BuildResult {
  const processNode = addNode(
    builder,
    "process",
    kind,
    {
      instruction: kind,
      controlFlow: {
        kind,
      },
    },
    column,
  );
  const pending = [{ sourceId: processNode.id, sourceHandle: "out" }];

  return {
    entryId: processNode.id,
    pending: [],
    breaks: kind === "break" ? pending : [],
    continues: kind === "continue" ? pending : [],
  };
}

type ForInitializerBuildResult = BuildResult & {
  code: string;
  nodeIds: string[];
};

type BuiltSwitchCase = {
  test: string | null;
  result: BuildResult;
};

function buildForInitializer(
  initializer: ForStatement["init"],
  builder: DiagramBuilder,
  column: number,
): ForInitializerBuildResult {
  if (!initializer) {
    return {
      code: "",
      nodeIds: [],
      pending: [],
      breaks: [],
      continues: [],
    };
  }

  const instructions =
    initializer.type === "VariableDeclaration"
      ? initializer.declarations.map((declaration) =>
          variableDeclaratorToInstruction(initializer.kind, declaration),
        )
      : [expressionToCode(initializer)];
  let entryId: string | undefined;
  let pending: PendingConnection[] = [];
  const nodeIds: string[] = [];

  for (const instruction of instructions) {
    const node = addNode(
      builder,
      "process",
      instruction,
      { instruction },
      column,
    );

    nodeIds.push(node.id);

    if (!entryId) {
      entryId = node.id;
    }

    connectPendingToTarget(builder, pending, node.id);
    pending = [{ sourceId: node.id, sourceHandle: "out" }];
  }

  return {
    code:
      initializer.type === "VariableDeclaration"
        ? variableDeclarationToCode(initializer)
        : expressionToCode(initializer),
    nodeIds,
    entryId,
    pending,
    breaks: [],
    continues: [],
  };
}

function buildSwitchCase(
  switchCase: SwitchCase,
  builder: DiagramBuilder,
  column: number,
): BuiltSwitchCase {
  return {
    test: switchCase.test ? expressionToCode(switchCase.test) : null,
    result: buildStatementSequence(switchCase.consequent, builder, column),
  };
}

function findSwitchFallthroughEntry(
  cases: BuiltSwitchCase[],
  startIndex: number,
) {
  for (let index = startIndex; index < cases.length; index += 1) {
    const entryId = cases[index].result.entryId;

    if (entryId) {
      return entryId;
    }
  }

  return undefined;
}

function setForInitMetadata(
  builder: DiagramBuilder,
  nodeIds: string[],
  loopDecisionId: string,
) {
  for (const nodeId of nodeIds) {
    const node = builder.nodes.find((item) => item.id === nodeId);

    if (node?.type === "process" && "instruction" in node.data.config) {
      node.data.config.controlFlow = {
        kind: "forInit",
        loopDecisionId,
      };
    }
  }
}

function setForDecisionMetadata(
  node: Extract<ImportedFlowNode, { type: "decision" }>,
  metadata: {
    init: string;
    test: string | null;
    update: string;
    initNodeIds: string[];
    updateNodeId?: string;
    bodyEntryId?: string;
  },
) {
  node.data.config.controlFlow = {
    kind: "for",
    ...metadata,
  };
}

function setDecisionSwitchMetadata(
  node: Extract<ImportedFlowNode, { type: "decision" }>,
  metadata: {
    discriminant: string;
    cases: Array<{ test: string | null; entryId?: string }>;
    caseDecisionIds: string[];
    exitSources: PendingConnection[];
  },
) {
  node.data.config.controlFlow = {
    kind: "switch",
    discriminant: metadata.discriminant,
    cases: metadata.cases,
    caseDecisionIds: metadata.caseDecisionIds,
    exitSources: metadata.exitSources.map(pendingConnectionToReference),
  };
}

function setDecisionSwitchCaseMetadata(
  node: Extract<ImportedFlowNode, { type: "decision" }>,
  switchRootId: string,
  test: string,
) {
  node.data.config.controlFlow = {
    kind: "switchCase",
    switchRootId,
    test,
  };
}

function pendingConnectionToReference(
  pending: PendingConnection,
): FlowPendingConnectionReference {
  return {
    sourceId: pending.sourceId,
    sourceHandle: pending.sourceHandle,
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

  if (expression.type === "ConditionalExpression") {
    return conditionalExpressionToCode(expression);
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

  if (expression.type === "SequenceExpression") {
    return sequenceExpressionToCode(expression);
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

  if (expression.type === "ArrayExpression") {
    return `[${expression.elements
      .map((element) => (element ? argumentToCode(element) : ""))
      .join(", ")}]`;
  }

  if (expression.type === "ObjectExpression") {
    return `{ ${expression.properties.map(objectPropertyToCode).join(", ")} }`;
  }

  if (expression.type === "TemplateLiteral") {
    return templateLiteralToCode(expression);
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

function conditionalExpressionToCode(expression: ConditionalExpression) {
  return `${expressionToCode(expression.test)} ? ${expressionToCode(
    expression.consequent,
  )} : ${expressionToCode(expression.alternate)}`;
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

function sequenceExpressionToCode(expression: SequenceExpression) {
  return expression.expressions.map(expressionToCode).join(", ");
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

function objectPropertyToCode(
  property: Extract<
    Extract<Expression, { type: "ObjectExpression" }>["properties"][number],
    { type: "ObjectProperty" | "SpreadElement" | "ObjectMethod" }
  >,
) {
  if (property.type === "SpreadElement") {
    return `...${expressionToCode(property.argument)}`;
  }

  if (property.type !== "ObjectProperty") {
    throw new UnsupportedSyntaxError(
      `La propiedad de objeto "${property.type}" todavia no esta soportada.`,
    );
  }

  const key = objectPropertyKeyToCode(property);
  const value = expressionToCode(property.value as Expression);

  if (
    !property.computed &&
    property.key.type === "Identifier" &&
    property.value.type === "Identifier" &&
    property.key.name === property.value.name
  ) {
    return property.key.name;
  }

  return `${key}: ${value}`;
}

function objectPropertyKeyToCode(property: ObjectProperty) {
  if (property.computed) {
    return `[${expressionToCode(property.key as Expression)}]`;
  }

  if (property.key.type === "Identifier") {
    return property.key.name;
  }

  if (property.key.type === "StringLiteral") {
    return JSON.stringify(property.key.value);
  }

  if (property.key.type === "NumericLiteral") {
    return String(property.key.value);
  }

  throw new UnsupportedSyntaxError(
    `La clave de objeto "${property.key.type}" todavia no esta soportada.`,
  );
}

function templateLiteralToCode(expression: TemplateLiteral) {
  let code = "`";

  expression.quasis.forEach((quasi, index) => {
    code += quasi.value.raw;

    const embeddedExpression = expression.expressions[index];

    if (embeddedExpression) {
      code += "${" + expressionToCode(embeddedExpression as Expression) + "}";
    }
  });

  return `${code}\``;
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

function functionParameterToDefinition(
  parameter: FunctionDeclaration["params"][number],
): FlowFunctionParameterDefinition {
  if (parameter.type === "Identifier") {
    return {
      name: parameter.name,
      source: parameter.name,
    };
  }

  if (
    parameter.type === "AssignmentPattern" &&
    parameter.left.type === "Identifier"
  ) {
    const defaultValue = expressionToCode(parameter.right);

    return {
      name: parameter.left.name,
      source: `${parameter.left.name} = ${defaultValue}`,
      defaultValue,
    };
  }

  if (
    parameter.type === "RestElement" &&
    parameter.argument.type === "Identifier"
  ) {
    return {
      name: parameter.argument.name,
      source: `...${parameter.argument.name}`,
      rest: true,
    };
  }

  throw new UnsupportedSyntaxError(
    `El parametro "${parameter.type}" todavia no esta soportado. El destructuring queda fuera por ahora.`,
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
