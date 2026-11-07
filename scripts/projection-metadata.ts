import type { RootIntegration } from "./manifest-types.ts";

export type ProjectionMetadataDeclaration = Readonly<{
  name: string;
  productName: string;
  choiceName?: string;
  choiceNote?: string;
  configNextStep: string;
  firstRunSteps?: readonly string[];
  editorTerminalApp?: string;
  harnessDir: string;
  onboarding?: Readonly<{ dst: string; harnessDst?: string; projectRoot?: boolean }> | null;
}>;
export type ProjectionMetadataRules = Readonly<{
  encodeRootIntegration: (input: Readonly<{ integration: RootIntegration }>) => RootIntegration & { readonly extendedPolicy?: string };
}>;
export type ProjectionMetadataRequest = Readonly<{
  declaration: ProjectionMetadataDeclaration;
  managedDirectories: readonly string[];
  rootIntegrations: readonly RootIntegration[];
  buildVersion: string;
  rules: ProjectionMetadataRules;
}>;
export type PreparedProjectionMetadata = Readonly<{
  projection: Readonly<Record<string, unknown>>;
  stamp: Readonly<{ schemaVersion: number; frameworkVersion: string; distribution: string; harnessDir: string }>;
}>;

function onboardingDescriptor({ declaration }: Pick<ProjectionMetadataRequest, "declaration">): { readonly onboarding?: string } {
  if (declaration.onboarding?.harnessDst) return { onboarding: `${declaration.harnessDir}/${declaration.onboarding.harnessDst}` };
  if (declaration.onboarding && !declaration.onboarding.projectRoot) return { onboarding: `${declaration.harnessDir}/${declaration.onboarding.dst}` };
  return {};
}

function projectionDescriptor({ declaration, managedDirectories, rootIntegrations, rules }: ProjectionMetadataRequest) {
  return {
    schemaVersion: 1,
    distribution: declaration.name,
    productName: declaration.productName,
    ...(declaration.choiceName ? { choiceName: declaration.choiceName } : {}),
    ...(declaration.choiceNote ? { choiceNote: declaration.choiceNote } : {}),
    configNextStep: declaration.configNextStep,
    ...(declaration.firstRunSteps ? { firstRunSteps: declaration.firstRunSteps } : {}),
    ...(declaration.editorTerminalApp ? { editorTerminalApp: declaration.editorTerminalApp } : {}),
    harnessDir: declaration.harnessDir,
    ...onboardingDescriptor({ declaration }),
    managedDirectories,
    rootIntegrations: rootIntegrations.map((integration) => rules.encodeRootIntegration({ integration })),
  };
}

export function prepareProjectionMetadata(request: ProjectionMetadataRequest): PreparedProjectionMetadata {
  const projection = projectionDescriptor(request);
  const stamp = { schemaVersion: 1, frameworkVersion: request.buildVersion, distribution: request.declaration.name, harnessDir: request.declaration.harnessDir };
  return { projection, stamp };
}

export function projectionMetadataText({ value }: Readonly<{ value: Readonly<Record<string, unknown>> }>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
