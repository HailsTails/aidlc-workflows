import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ParseError, parse as parseJsonc } from "jsonc-parser";
import { z } from "zod";

type PackageManagerConfig = {
  readonly primary: string;
  readonly runnerAllowlist: readonly string[];
};

type NotesSinkConfig =
  | { readonly adapter: "record-dir" }
  | { readonly adapter: "local-markdown"; readonly directory: string }
  | { readonly adapter: "obsidian-mcp"; readonly vaultMarker: string };

type IdentityConfig = {
  readonly adapter: "workspace-default" | "git-author";
  readonly name: string;
  readonly email: string;
};

type BacklogStoreConfig =
  | { readonly adapter: "state-file" }
  | { readonly adapter: "flat-file"; readonly directory: string }
  | { readonly adapter: "helen-tasks"; readonly endpoint: string };

const sensitiveVaultPathMarkerBrand: unique symbol = Symbol(
  "SensitiveVaultPathMarker",
);

type SensitiveVaultPathMarker = {
  readonly [sensitiveVaultPathMarkerBrand]: "SensitiveVaultPathMarker";
  readonly classifyPath: (candidate: {
    readonly candidatePath: string;
  }) => "vault-path" | "outside-vault";
  readonly toJSON: () => "[REDACTED]";
};

type VaultWritePolicy =
  | { readonly adapter: "unconfigured" }
  | {
      readonly adapter: "mcp-only";
      readonly pathMarker: SensitiveVaultPathMarker;
    };

type VaultPolicyReadFailure =
  | { readonly kind: "configuration-unreadable" }
  | { readonly kind: "configuration-malformed" }
  | {
      readonly kind: "configuration-invalid";
      readonly invalidConfigField: string;
    };

type VaultPolicyResolution =
  | { readonly outcome: "resolved"; readonly vaultPolicy: VaultWritePolicy }
  | {
      readonly outcome: "failed";
      readonly vaultPolicyReadFailure: VaultPolicyReadFailure;
    };

type VaultConfigurationReader = {
  readonly readConfiguration: (consumer: {
    readonly projectDir: string;
  }) => LoadedConfig;
};

type MechanismsConfig = {
  readonly vaultWritePolicy: VaultWritePolicy;
  readonly notesSink: NotesSinkConfig;
  readonly identity: IdentityConfig;
  readonly backlogStore: BacklogStoreConfig;
};

type ProjectIdentityConfig = {
  readonly operator: string;
  readonly authorIdentity: string;
  readonly reviewerIdentity: string;
  readonly deployTarget: string;
  readonly backlogStore: string;
  readonly mergeCommand: string;
  readonly reviewCommand: ResolvedReviewCommand;
  readonly prCommand: string;
  readonly deployCommand: string;
};

declare const nonBlankExecutableBrand: unique symbol;

type NonBlankExecutable = string & {
  readonly [nonBlankExecutableBrand]: "NonBlankExecutable";
};

type ReviewCommandBinding = {
  readonly executable: NonBlankExecutable;
  readonly commandArguments: readonly string[];
};

type ConfiguredReviewCommand = {
  readonly kind: "configured";
  readonly binding: ReviewCommandBinding;
};

type ResolvedReviewCommand =
  | ConfiguredReviewCommand
  | { readonly kind: "unconfigured" };

type ConstitutionScopeConfig = {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly scriptGlobs: readonly string[];
  readonly uiGlobs: readonly string[];
};

const rinGatesSchema = z.object({
  exceptionWhyChains: z.boolean().default(false),
});

type RinGatesConfig = z.infer<typeof rinGatesSchema>;

type SettledR7OptIn =
  | { readonly kind: "enabled" }
  | { readonly kind: "disabled" };

type R7OptIn =
  | SettledR7OptIn
  | { readonly kind: "invalid"; readonly reason: string };

type HarnessConfig = {
  readonly projectName: string;
  readonly defaultScope: string;
  readonly rulesetRoot: string;
  readonly stageGraph: string;
  readonly packageManager: PackageManagerConfig;
  readonly mechanisms: MechanismsConfig;
  readonly projectIdentity: ProjectIdentityConfig;
  readonly constitution?: ConstitutionScopeConfig;
  readonly rinGates: RinGatesConfig;
};

type ConfigSource = "file" | "defaults";

type ProjectIdentityFailure =
  | { readonly kind: "missing-file"; readonly path: string }
  | {
      readonly kind: "parse-failure";
      readonly failurePhase: "read" | "parse";
      readonly path: string;
      readonly detail: string;
    }
  | {
      readonly kind: "validation-failure";
      readonly field: string;
      readonly detail: string;
    };

type ProjectIdentityOutcome =
  | { readonly kind: "unresolved"; readonly reason: ProjectIdentityFailure }
  | {
      readonly kind: "resolved";
      readonly projectIdentity: ProjectIdentityConfig;
    };

type LoadedConfig = {
  readonly config: HarnessConfig;
  readonly source: ConfigSource;
  readonly warning: string | null;
  readonly failure: ProjectIdentityFailure | null;
};

const CONFIG_FILENAME = "harness.config.json";

const defaultMechanisms: MechanismsConfig = {
  vaultWritePolicy: { adapter: "unconfigured" },
  notesSink: { adapter: "record-dir" },
  identity: {
    adapter: "workspace-default",
    name: "AIDLC Workspace",
    email: "aidlc@localhost",
  },
  backlogStore: { adapter: "state-file" },
};

const defaultProjectIdentity: ProjectIdentityConfig = {
  operator: "the operator",
  authorIdentity: "the authoring identity",
  reviewerIdentity: "the reviewing identity",
  deployTarget: "the deployment target",
  backlogStore: "the backlog store",
  mergeCommand:
    "(unconfigured: set projectIdentity.mergeCommand to a command that refuses a merge whose latest review verdict is not APPROVED)",
  reviewCommand: { kind: "unconfigured" },
  prCommand:
    "(unconfigured: set projectIdentity.prCommand to a command that opens or updates the pull request for the current branch under the authoring identity)",
  deployCommand:
    "(unconfigured: set projectIdentity.deployCommand to a command that deploys the target, total and idempotent)",
};

const defaultConfig: HarnessConfig = {
  projectName: "aidlc-workspace",
  defaultScope: "workshop",
  rulesetRoot: "aidlc/spaces/default/memory",
  stageGraph: ".claude/tools/data/stage-graph.json",
  packageManager: {
    primary: "bun",
    runnerAllowlist: [
      "uv run",
      "pnpm",
      "npm",
      "npx",
      "bun run",
      "bun x",
      "bun test",
      "bun install",
      "bash .specify",
      "python -m json.tool",
    ],
  },
  mechanisms: defaultMechanisms,
  projectIdentity: defaultProjectIdentity,
  rinGates: { exceptionWhyChains: false },
};

type Validation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
  typeof candidate === "object" &&
  candidate !== null &&
  !Array.isArray(candidate);

const requireString = ({
  container,
  key,
}: {
  readonly container: Record<string, unknown>;
  readonly key: string;
}): Validation<string> => {
  const raw = container[key];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: `"${key}" must be a non-empty string` };
  }
  return { ok: true, value: raw };
};

const reviewCommandSchema = z
  .object({
    executable: z.custom<NonBlankExecutable>(
      (candidate) =>
        typeof candidate === "string" && candidate.trim().length > 0,
    ),
    commandArguments: z.array(z.string()),
  })
  .strict();

const resolveReviewCommand = ({
  container,
}: {
  readonly container: Record<string, unknown>;
}): Validation<ResolvedReviewCommand> => {
  const raw = container["reviewCommand"];
  if (raw === undefined) return { ok: true, value: { kind: "unconfigured" } };
  const parsed = reviewCommandSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: '"reviewCommand" must be a strict executable and argument vector',
    };
  }
  return {
    ok: true,
    value: {
      kind: "configured",
      binding: {
        executable: parsed.data.executable,
        commandArguments: parsed.data.commandArguments,
      },
    },
  };
};

const requireStringArray = ({
  container,
  key,
}: {
  readonly container: Record<string, unknown>;
  readonly key: string;
}): Validation<readonly string[]> => {
  const raw = container[key];
  if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== "string")) {
    return { ok: false, error: `"${key}" must be an array of strings` };
  }
  return { ok: true, value: raw };
};

const validatePackageManager = ({
  container,
}: {
  readonly container: Record<string, unknown>;
}): Validation<PackageManagerConfig> => {
  const raw = container["packageManager"];
  if (!isRecord(raw)) {
    return { ok: false, error: `"packageManager" must be an object` };
  }
  const primary = requireString({ container: raw, key: "primary" });
  if (!primary.ok) return primary;
  const runnerAllowlist = requireStringArray({
    container: raw,
    key: "runnerAllowlist",
  });
  if (!runnerAllowlist.ok) return runnerAllowlist;
  return {
    ok: true,
    value: { primary: primary.value, runnerAllowlist: runnerAllowlist.value },
  };
};

const validateNotesSink = ({
  raw,
}: {
  readonly raw: Record<string, unknown>;
}): Validation<NotesSinkConfig> => {
  const adapter = requireString({ container: raw, key: "adapter" });
  if (!adapter.ok) return adapter;
  if (adapter.value === "record-dir") {
    return { ok: true, value: { adapter: "record-dir" } };
  }
  if (adapter.value === "local-markdown") {
    const directory = requireString({ container: raw, key: "directory" });
    if (!directory.ok) return directory;
    return {
      ok: true,
      value: { adapter: "local-markdown", directory: directory.value },
    };
  }
  if (adapter.value === "obsidian-mcp") {
    const vaultMarker = requireString({ container: raw, key: "vaultMarker" });
    if (!vaultMarker.ok) return vaultMarker;
    return {
      ok: true,
      value: { adapter: "obsidian-mcp", vaultMarker: vaultMarker.value },
    };
  }
  return {
    ok: false,
    error: `notesSink.adapter "${adapter.value}" is not one of record-dir|local-markdown|obsidian-mcp`,
  };
};

const validateIdentity = ({
  raw,
}: {
  readonly raw: Record<string, unknown>;
}): Validation<IdentityConfig> => {
  const adapter = requireString({ container: raw, key: "adapter" });
  if (!adapter.ok) return adapter;
  if (adapter.value !== "workspace-default" && adapter.value !== "git-author") {
    return {
      ok: false,
      error: `identity.adapter "${adapter.value}" is not one of workspace-default|git-author`,
    };
  }
  const name = requireString({ container: raw, key: "name" });
  if (!name.ok) return name;
  const email = requireString({ container: raw, key: "email" });
  if (!email.ok) return email;
  return {
    ok: true,
    value: { adapter: adapter.value, name: name.value, email: email.value },
  };
};

const validateBacklogStore = ({
  raw,
}: {
  readonly raw: Record<string, unknown>;
}): Validation<BacklogStoreConfig> => {
  const adapter = requireString({ container: raw, key: "adapter" });
  if (!adapter.ok) return adapter;
  if (adapter.value === "state-file") {
    return { ok: true, value: { adapter: "state-file" } };
  }
  if (adapter.value === "flat-file") {
    const directory = requireString({ container: raw, key: "directory" });
    if (!directory.ok) return directory;
    return {
      ok: true,
      value: { adapter: "flat-file", directory: directory.value },
    };
  }
  if (adapter.value === "helen-tasks") {
    const endpoint = requireString({ container: raw, key: "endpoint" });
    if (!endpoint.ok) return endpoint;
    return {
      ok: true,
      value: { adapter: "helen-tasks", endpoint: endpoint.value },
    };
  }
  return {
    ok: false,
    error: `backlogStore.adapter "${adapter.value}" is not one of state-file|flat-file|helen-tasks`,
  };
};

const vaultPathMarkerSchema = z.string().refine((marker) =>
  marker
    .replaceAll("\\", "/")
    .split("/")
    .every(
      (segment) =>
        /\S/.test(segment) &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("\u0000"),
    ),
);

const vaultWritePolicySchema = z.discriminatedUnion("adapter", [
  z.object({ adapter: z.literal("unconfigured") }).strict(),
  z
    .object({
      adapter: z.literal("mcp-only"),
      pathMarker: vaultPathMarkerSchema,
    })
    .strict(),
]);

const sensitiveVaultPathMarker = ({
  literalMarker,
}: {
  readonly literalMarker: string;
}): SensitiveVaultPathMarker => {
  const normalizedMarker = `/${literalMarker.replaceAll("\\", "/").toLowerCase()}/`;
  return {
    [sensitiveVaultPathMarkerBrand]: "SensitiveVaultPathMarker",
    classifyPath: ({ candidatePath }) =>
      `/${candidatePath.replaceAll("\\", "/").toLowerCase()}/`.includes(
        normalizedMarker,
      )
        ? "vault-path"
        : "outside-vault",
    toJSON: () => "[REDACTED]",
  };
};

const validateVaultWritePolicy = ({
  rawPolicy,
}: {
  readonly rawPolicy: unknown;
}): Validation<VaultWritePolicy> => {
  if (rawPolicy === undefined)
    return { ok: true, value: { adapter: "unconfigured" } };
  const parsed = vaultWritePolicySchema.safeParse(rawPolicy);
  if (!parsed.success)
    return {
      ok: false,
      error: '"vaultWritePolicy" must be a valid vault policy',
    };
  return {
    ok: true,
    value:
      parsed.data.adapter === "unconfigured"
        ? { adapter: "unconfigured" }
        : {
            adapter: "mcp-only",
            pathMarker: sensitiveVaultPathMarker({
              literalMarker: parsed.data.pathMarker,
            }),
          },
  };
};

const validateMechanisms = ({
  container,
}: {
  readonly container: Record<string, unknown>;
}): Validation<MechanismsConfig> => {
  const raw = container["mechanisms"];
  if (raw === undefined) {
    return { ok: true, value: defaultMechanisms };
  }
  if (!isRecord(raw)) {
    return { ok: false, error: `"mechanisms" must be an object` };
  }
  const vaultWritePolicy = validateVaultWritePolicy({
    rawPolicy: raw["vaultWritePolicy"],
  });
  if (!vaultWritePolicy.ok) return vaultWritePolicy;
  const notesSinkRaw = raw["notesSink"];
  const notesSink: Validation<NotesSinkConfig> = isRecord(notesSinkRaw)
    ? validateNotesSink({ raw: notesSinkRaw })
    : {
        ok: true,
        value: defaultMechanisms.notesSink,
      };
  if (!notesSink.ok) return notesSink;
  const identityRaw = raw["identity"];
  const identity: Validation<IdentityConfig> = isRecord(identityRaw)
    ? validateIdentity({ raw: identityRaw })
    : {
        ok: true,
        value: defaultMechanisms.identity,
      };
  if (!identity.ok) return identity;
  const backlogStoreRaw = raw["backlogStore"];
  const backlogStore: Validation<BacklogStoreConfig> = isRecord(backlogStoreRaw)
    ? validateBacklogStore({ raw: backlogStoreRaw })
    : {
        ok: true,
        value: defaultMechanisms.backlogStore,
      };
  if (!backlogStore.ok) return backlogStore;
  return {
    ok: true,
    value: {
      vaultWritePolicy: vaultWritePolicy.value,
      notesSink: notesSink.value,
      identity: identity.value,
      backlogStore: backlogStore.value,
    },
  };
};

const validateProjectIdentity = ({
  container,
}: {
  readonly container: Record<string, unknown>;
}): Validation<ProjectIdentityConfig> => {
  const raw = container["projectIdentity"];
  if (raw === undefined) {
    return { ok: true, value: defaultProjectIdentity };
  }
  if (!isRecord(raw)) {
    return { ok: false, error: `"projectIdentity" must be an object` };
  }
  const operator = requireString({ container: raw, key: "operator" });
  if (!operator.ok) return operator;
  const authorIdentity = requireString({
    container: raw,
    key: "authorIdentity",
  });
  if (!authorIdentity.ok) return authorIdentity;
  const reviewerIdentity = requireString({
    container: raw,
    key: "reviewerIdentity",
  });
  if (!reviewerIdentity.ok) return reviewerIdentity;
  if (authorIdentity.value === reviewerIdentity.value) {
    return {
      ok: false,
      error: `"authorIdentity" and "reviewerIdentity" must differ — both are "${authorIdentity.value}", so the review gate cannot hold: it rests on the host forbidding an actor from reviewing its own pull request, and one identity filling both roles approves its own work with no error and no visible symptom`,
    };
  }
  const deployTarget = requireString({ container: raw, key: "deployTarget" });
  if (!deployTarget.ok) return deployTarget;
  const backlogStore = requireString({ container: raw, key: "backlogStore" });
  if (!backlogStore.ok) return backlogStore;
  const mergeCommand = requireString({ container: raw, key: "mergeCommand" });
  if (!mergeCommand.ok) return mergeCommand;
  const reviewCommand = resolveReviewCommand({ container: raw });
  if (!reviewCommand.ok) return reviewCommand;
  const prCommand = requireString({ container: raw, key: "prCommand" });
  if (!prCommand.ok) return prCommand;
  const deployCommand = requireString({ container: raw, key: "deployCommand" });
  if (!deployCommand.ok) return deployCommand;
  return {
    ok: true,
    value: {
      operator: operator.value,
      authorIdentity: authorIdentity.value,
      reviewerIdentity: reviewerIdentity.value,
      deployTarget: deployTarget.value,
      backlogStore: backlogStore.value,
      mergeCommand: mergeCommand.value,
      reviewCommand: reviewCommand.value,
      prCommand: prCommand.value,
      deployCommand: deployCommand.value,
    },
  };
};

const optionalStringArray = ({
  container,
  key,
}: {
  readonly container: Record<string, unknown>;
  readonly key: string;
}): Validation<readonly string[] | undefined> => {
  const raw = container[key];
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== "string")) {
    return {
      ok: false,
      error: `constitution.${key} must be an array of strings`,
    };
  }
  return {
    ok: true,
    value: raw.filter((entry): entry is string => typeof entry === "string"),
  };
};

const validateConstitution = ({
  container,
}: {
  readonly container: Record<string, unknown>;
}): Validation<ConstitutionScopeConfig | undefined> => {
  const raw = container["constitution"];
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(raw)) {
    return { ok: false, error: `"constitution" must be an object` };
  }
  const include = optionalStringArray({ container: raw, key: "include" });
  if (!include.ok) return include;
  const exclude = optionalStringArray({ container: raw, key: "exclude" });
  if (!exclude.ok) return exclude;
  const scriptGlobs = optionalStringArray({
    container: raw,
    key: "scriptGlobs",
  });
  if (!scriptGlobs.ok) return scriptGlobs;
  const uiGlobs = optionalStringArray({ container: raw, key: "uiGlobs" });
  if (!uiGlobs.ok) return uiGlobs;
  return {
    ok: true,
    value: {
      include: include.value ?? [],
      exclude: exclude.value ?? [],
      scriptGlobs: scriptGlobs.value ?? [],
      uiGlobs: uiGlobs.value ?? [],
    },
  };
};

const validateRinGates = ({
  container,
}: {
  readonly container: Record<string, unknown>;
}): Validation<RinGatesConfig> => {
  const declared = container["rinGates"];
  const parsed = rinGatesSchema.safeParse(
    declared === undefined ? {} : declared,
  );
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  const offendsBlock = parsed.error.issues.some(
    (issue) => issue.path.length === 0,
  );
  return {
    ok: false,
    error: offendsBlock
      ? `"rinGates" must be an object`
      : `"rinGates.exceptionWhyChains" must be a boolean`,
  };
};

const validateHarnessConfig = ({
  parsed,
}: {
  readonly parsed: unknown;
}): Validation<HarnessConfig> => {
  if (!isRecord(parsed)) {
    return { ok: false, error: "root must be a JSON object" };
  }
  const projectName = requireString({ container: parsed, key: "projectName" });
  if (!projectName.ok) return projectName;
  const defaultScope = requireString({
    container: parsed,
    key: "defaultScope",
  });
  if (!defaultScope.ok) return defaultScope;
  const rulesetRoot = requireString({ container: parsed, key: "rulesetRoot" });
  if (!rulesetRoot.ok) return rulesetRoot;
  const stageGraph = requireString({ container: parsed, key: "stageGraph" });
  if (!stageGraph.ok) return stageGraph;
  const packageManager = validatePackageManager({ container: parsed });
  if (!packageManager.ok) return packageManager;
  const mechanisms = validateMechanisms({ container: parsed });
  if (!mechanisms.ok) return mechanisms;
  const projectIdentity = validateProjectIdentity({ container: parsed });
  if (!projectIdentity.ok) return projectIdentity;
  const constitution = validateConstitution({ container: parsed });
  if (!constitution.ok) return constitution;
  const rinGates = validateRinGates({ container: parsed });
  if (!rinGates.ok) return rinGates;
  return {
    ok: true,
    value: {
      projectName: projectName.value,
      defaultScope: defaultScope.value,
      rulesetRoot: rulesetRoot.value,
      stageGraph: stageGraph.value,
      packageManager: packageManager.value,
      mechanisms: mechanisms.value,
      projectIdentity: projectIdentity.value,
      rinGates: rinGates.value,
      ...(constitution.value === undefined
        ? {}
        : { constitution: constitution.value }),
    },
  };
};

const configPath = ({ projectDir }: { readonly projectDir: string }): string =>
  join(projectDir, CONFIG_FILENAME);

const quotedKeyPattern = /"([^"]+)"/;

const offendingField = ({ error }: { readonly error: string }): string =>
  quotedKeyPattern.exec(error)?.[1] ?? "root";

const readConfig = ({
  projectDir,
}: {
  readonly projectDir: string;
}): LoadedConfig => {
  const path = configPath({ projectDir });
  let rawConfiguration: string;
  try {
    rawConfiguration = readFileSync(path, "utf-8");
  } catch (failure) {
    if (
      failure instanceof Error &&
      "code" in failure &&
      failure.code === "ENOENT"
    ) {
      return {
        config: defaultConfig,
        source: "defaults",
        warning: null,
        failure: { kind: "missing-file", path },
      };
    }
    const detail = `${CONFIG_FILENAME} is unreadable or not valid JSON`;
    return {
      config: defaultConfig,
      source: "defaults",
      warning: `${detail} — using defaults`,
      failure: { kind: "parse-failure", failurePhase: "read", path, detail },
    };
  }
  const parseErrors: ParseError[] = [];
  const parsed: unknown = parseJsonc(rawConfiguration, parseErrors);
  if (parsed === undefined || parseErrors.length > 0) {
    const detail = `${CONFIG_FILENAME} is unreadable or not valid JSON`;
    return {
      config: defaultConfig,
      source: "defaults",
      warning: `${detail} — using defaults`,
      failure: { kind: "parse-failure", failurePhase: "parse", path, detail },
    };
  }
  const validated = validateHarnessConfig({ parsed });
  if (!validated.ok) {
    return {
      config: defaultConfig,
      source: "defaults",
      warning: `${CONFIG_FILENAME} is malformed (${validated.error}) — using defaults`,
      failure: {
        kind: "validation-failure",
        field: offendingField({ error: validated.error }),
        detail: validated.error,
      },
    };
  }
  return {
    config: validated.value,
    source: "file",
    warning: null,
    failure: null,
  };
};

const resolveVaultWritePolicy = ({
  loadedConfig,
}: {
  readonly loadedConfig: LoadedConfig;
}): VaultPolicyResolution => {
  const { failure } = loadedConfig;
  if (failure === null)
    return {
      outcome: "resolved",
      vaultPolicy: loadedConfig.config.mechanisms.vaultWritePolicy,
    };
  switch (failure.kind) {
    case "missing-file":
      return { outcome: "resolved", vaultPolicy: { adapter: "unconfigured" } };
    case "parse-failure":
      return {
        outcome: "failed",
        vaultPolicyReadFailure: {
          kind:
            failure.failurePhase === "read"
              ? "configuration-unreadable"
              : "configuration-malformed",
        },
      };
    case "validation-failure":
      return {
        outcome: "failed",
        vaultPolicyReadFailure: {
          kind: "configuration-invalid",
          invalidConfigField: failure.field,
        },
      };
  }
};

const createDefaultVaultConfigurationReader = (): VaultConfigurationReader => ({
  readConfiguration: readConfig,
});

const readVaultPolicy = ({
  projectDir,
  reader,
}: {
  readonly projectDir: string;
  readonly reader: VaultConfigurationReader;
}): VaultPolicyResolution =>
  resolveVaultWritePolicy({
    loadedConfig: reader.readConfiguration({ projectDir }),
  });

const resolveProjectIdentity = ({
  projectDir,
}: {
  readonly projectDir: string;
}): ProjectIdentityOutcome => {
  const loaded = readConfig({ projectDir });
  if (loaded.failure !== null) {
    return { kind: "unresolved", reason: loaded.failure };
  }
  return { kind: "resolved", projectIdentity: loaded.config.projectIdentity };
};

const loadHarnessConfig = ({
  projectDir,
}: {
  readonly projectDir: string;
}): HarnessConfig => readConfig({ projectDir }).config;

const configProjectName = ({
  projectDir,
}: {
  readonly projectDir: string;
}): string => loadHarnessConfig({ projectDir }).projectName;

const configDefaultScope = ({
  projectDir,
}: {
  readonly projectDir: string;
}): string => loadHarnessConfig({ projectDir }).defaultScope;

const configRulesetRoot = ({
  projectDir,
}: {
  readonly projectDir: string;
}): string => loadHarnessConfig({ projectDir }).rulesetRoot;

const configStageGraphPath = ({
  projectDir,
}: {
  readonly projectDir: string;
}): string => loadHarnessConfig({ projectDir }).stageGraph;

const configRunnerAllowlist = ({
  projectDir,
}: {
  readonly projectDir: string;
}): readonly string[] =>
  loadHarnessConfig({ projectDir }).packageManager.runnerAllowlist;

const configMechanisms = ({
  projectDir,
}: {
  readonly projectDir: string;
}): MechanismsConfig => loadHarnessConfig({ projectDir }).mechanisms;

const configIdentity = ({
  projectDir,
}: {
  readonly projectDir: string;
}): IdentityConfig => loadHarnessConfig({ projectDir }).mechanisms.identity;

const configNotesSink = ({
  projectDir,
}: {
  readonly projectDir: string;
}): NotesSinkConfig => loadHarnessConfig({ projectDir }).mechanisms.notesSink;

const configBacklogStore = ({
  projectDir,
}: {
  readonly projectDir: string;
}): BacklogStoreConfig =>
  loadHarnessConfig({ projectDir }).mechanisms.backlogStore;

const configConstitution = ({
  projectDir,
}: {
  readonly projectDir: string;
}): ConstitutionScopeConfig | undefined =>
  loadHarnessConfig({ projectDir }).constitution;

const configR7OptIn = ({
  projectDir,
}: {
  readonly projectDir: string;
}): R7OptIn => {
  const loaded = readConfig({ projectDir });
  if (loaded.failure?.kind === "missing-file") return { kind: "disabled" };
  if (loaded.failure !== null) {
    return { kind: "invalid", reason: loaded.failure.detail };
  }
  return loaded.config.rinGates.exceptionWhyChains
    ? { kind: "enabled" }
    : { kind: "disabled" };
};

const requiresExceptionWhyChains = ({
  optIn,
}: {
  readonly optIn: SettledR7OptIn;
}): boolean => {
  switch (optIn.kind) {
    case "enabled":
      return true;
    case "disabled":
      return false;
  }
};

const invokedDirectly =
  process.argv[1]?.endsWith("rin-harness-config.ts") ?? false;

if (invokedDirectly) {
  const projectDir = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
  const command = process.argv[2] ?? "print";
  if (command === "print") {
    const loaded = readConfig({ projectDir });
    if (loaded.warning !== null) {
      process.stderr.write(`rin-harness-config: ${loaded.warning}\n`);
    }
    process.stdout.write(`${JSON.stringify(loaded.config, null, 2)}\n`);
  } else {
    process.stderr.write(
      `rin-harness-config: unknown command "${command}" (print)\n`,
    );
    process.exit(1);
  }
}

export type {
  BacklogStoreConfig,
  ConfigSource,
  ConfiguredReviewCommand,
  ConstitutionScopeConfig,
  HarnessConfig,
  IdentityConfig,
  LoadedConfig,
  MechanismsConfig,
  NonBlankExecutable,
  NotesSinkConfig,
  PackageManagerConfig,
  ProjectIdentityConfig,
  ProjectIdentityFailure,
  ProjectIdentityOutcome,
  R7OptIn,
  ResolvedReviewCommand,
  ReviewCommandBinding,
  RinGatesConfig,
  SensitiveVaultPathMarker,
  SettledR7OptIn,
  VaultConfigurationReader,
  VaultPolicyReadFailure,
  VaultPolicyResolution,
  VaultWritePolicy,
};
export {
  CONFIG_FILENAME,
  configBacklogStore,
  configConstitution,
  configDefaultScope,
  configIdentity,
  configMechanisms,
  configNotesSink,
  configProjectName,
  configR7OptIn,
  configRulesetRoot,
  configRunnerAllowlist,
  configStageGraphPath,
  createDefaultVaultConfigurationReader,
  defaultConfig,
  defaultMechanisms,
  defaultProjectIdentity,
  loadHarnessConfig,
  readConfig,
  readVaultPolicy,
  requiresExceptionWhyChains,
  resolveProjectIdentity,
  resolveVaultWritePolicy,
  validateProjectIdentity,
};
