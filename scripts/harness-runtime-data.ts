type RuntimeDeclaration = {
  readonly name: string;
  readonly productName: string;
  readonly configNextStep: string;
  readonly harnessDir: string;
  readonly rulesRename: string | null;
  readonly runnerFrontmatterAdditions?: readonly string[];
  // Optional host declarations are forwarded; their existing owners interpret and validate them.
  readonly documentExtractors?: unknown;
  readonly hookActivation?: unknown;
  readonly kiroLayout?: unknown;
  readonly directiveMaxBytes?: unknown;
  readonly statusLine?: unknown;
  readonly agentFinishRecorded?: unknown;
};

// Runtime readers tolerate unknown fields; this projection alone selects what ships.
export function projectHarnessRuntimeData({ declaration }: {
  readonly declaration: RuntimeDeclaration;
}): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: 1,
    distribution: declaration.name,
    productName: declaration.productName,
    configNextStep: declaration.configNextStep,
    name: declaration.name,
    harnessDir: declaration.harnessDir,
    rulesSubdir: declaration.rulesRename ?? "rules",
    ...(declaration.runnerFrontmatterAdditions?.length
      ? { runnerFrontmatterAdditions: declaration.runnerFrontmatterAdditions } : {}),
    ...(declaration.documentExtractors ? { documentExtractors: declaration.documentExtractors } : {}),
    ...(declaration.hookActivation ? { hookActivation: declaration.hookActivation } : {}),
    ...(declaration.kiroLayout ? { kiroLayout: declaration.kiroLayout } : {}),
    ...(declaration.directiveMaxBytes ? { directiveMaxBytes: declaration.directiveMaxBytes } : {}),
    ...(declaration.statusLine ? { statusLine: declaration.statusLine } : {}),
    ...(declaration.agentFinishRecorded ? { agentFinishRecorded: declaration.agentFinishRecorded } : {}),
  };
}
