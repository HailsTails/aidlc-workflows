import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { EmbeddedRunReport } from "../../../core/mechanism-port/embedded-run-report-schema.ts";
import type { EmbeddedRunner } from "../../../core/mechanism-port/embedded-runner-module-schema.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type {
  ProjectionRequest,
  RunnerClause,
  RunRequest,
} from "../../../core/mechanism-port/runner-module-schema.ts";
import type {
  CaseVerdict,
  Hit,
  NativeException,
  ProjectionWrite,
} from "../../../core/mechanism-port/runner-result-schema.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { sameClauseAddress } from "../../../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { RuleState } from "./eslint-config-schema.ts";
import {
  type EslintPort,
  type IgnoredState,
  type LintedFile,
  type LintedMessage,
  type QueryInstance,
  reservedNamespace,
} from "./eslint-instance.ts";
import { type EslintPieceSettings, eslintPieceSettingsSchema } from "./eslint-piece-settings-schema.ts";
import { eslintPluginModuleSchema, type LoadedEslintPlugin } from "./eslint-plugin-schema.ts";
import { parseInlineConfigComment } from "./inline-config-parser.ts";
import { type PackageJsonScan, scanPackageJson, type SelectedRule } from "./package-script-scanner.ts";
import {
  type CurrentProjection,
  currentProjection,
  type ProjectedPiece,
  pluginImportOf,
  projectionState,
  projectionText,
  writeProjection,
} from "./projection.ts";
import { scriptSuppressionEntries, suppressionEntriesOf } from "./suppressions-scanner.ts";

export type EslintRunnerPorts = {
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly eslint: EslintPort;
};

type Outcome<Value> = Result<Value, RunnerFailure>;

type ConfiguredClause = {
  readonly clause: RunnerClause;
  readonly settings: EslintPieceSettings;
  readonly ruleId: string;
  readonly modulePath: string;
};

type SelectedClause = ConfiguredClause & { readonly plugin: LoadedEslintPlugin };

type CheckedFile = {
  readonly file: RepoPath;
  readonly states: readonly { readonly ruleId: string; readonly state: RuleState }[];
};

type QueriedFiles = {
  readonly ignored: readonly RepoPath[];
  readonly checked: readonly CheckedFile[];
};

type ProjectionEffect = "in-effect" | "not-in-effect";

type RecordedRunRequest = RunRequest & { readonly records: readonly ExceptionRecord[] };

type QueriedFile = {
  readonly file: RepoPath;
  readonly ignored: IgnoredState;
  readonly states: CheckedFile["states"];
};

const SUPPRESSIONS_FILE_NAME = "eslint-suppressions.json";

const PACKAGE_JSON_NAME = "package.json";

const INLINE_CONFIG_RULE_ID = `${reservedNamespace}/inline-config`;

const INLINE_DISABLE = "inline-disable";

const INLINE_RULE_CONFIG = "inline-rule-config";

const LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/;

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: request.pieceRoot, detail: request.detail },
});

const appendedOutcome = <Value>(request: {
  readonly gathered: Outcome<readonly Value[]>;
  readonly next: Outcome<readonly Value[]>;
}): Outcome<readonly Value[]> => {
  if (request.gathered.outcome === "failed") {
    return request.gathered;
  }
  if (request.next.outcome === "failed") {
    return request.next;
  }
  return { outcome: "ok", value: [...request.gathered.value, ...request.next.value] };
};

const collectOutcomes = <Value>(request: {
  readonly outcomes: readonly Outcome<readonly Value[]>[];
}): Outcome<readonly Value[]> =>
  request.outcomes.reduce<Outcome<readonly Value[]>>((gathered, next) => appendedOutcome({ gathered, next }), {
    outcome: "ok",
    value: [],
  });

const mappedOutcome = <Value, Mapped>(request: {
  readonly outcome: Outcome<Value>;
  readonly map: (okValue: Value) => Mapped;
}): Outcome<Mapped> =>
  request.outcome.outcome === "failed"
    ? request.outcome
    : { outcome: "ok", value: request.map(request.outcome.value) };

const listedOutcome = <Value>(request: { readonly outcome: Outcome<Value> }): Outcome<readonly Value[]> =>
  mappedOutcome({ outcome: request.outcome, map: (okValue): readonly Value[] => [okValue] });

const configuredClause = (request: {
  readonly clause: RunnerClause;
  readonly path: PathPort;
}): Outcome<ConfiguredClause> => {
  const settings = eslintPieceSettingsSchema.safeParse(request.clause.settings);
  if (!settings.success) {
    return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: settings.error.message });
  }
  if (settings.data.pluginNamespace === reservedNamespace) {
    return pieceInvalid({
      pieceRoot: request.clause.pieceRoot,
      detail: `the plugin namespace ${reservedNamespace} is reserved for discipline core`,
    });
  }
  return {
    outcome: "ok",
    value: {
      clause: request.clause,
      settings: settings.data,
      ruleId: `${settings.data.pluginNamespace}/${settings.data.rule}`,
      modulePath: request.path.join({
        segments: [request.clause.pieceRoot, settings.data.pluginModule],
      }),
    },
  };
};

const clashOf = (request: {
  readonly earlier: ConfiguredClause;
  readonly entry: ConfiguredClause;
}): "clashing" | "distinct" =>
  request.earlier.ruleId === request.entry.ruleId ||
  (request.earlier.settings.pluginNamespace === request.entry.settings.pluginNamespace &&
    request.earlier.modulePath !== request.entry.modulePath)
    ? "clashing"
    : "distinct";

const clashingClause = (request: {
  readonly configured: readonly ConfiguredClause[];
}): ConfiguredClause | undefined =>
  request.configured.find((entry, index) =>
    request.configured.slice(0, index).some((earlier) => clashOf({ earlier, entry }) === "clashing"),
  );

const configuredSelection = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
}): Outcome<readonly ConfiguredClause[]> => {
  const configured = collectOutcomes({
    outcomes: request.clauses.map((clause) =>
      listedOutcome({ outcome: configuredClause({ clause, path: request.path }) }),
    ),
  });
  if (configured.outcome === "failed") {
    return configured;
  }
  const clashing = clashingClause({ configured: configured.value });
  if (clashing !== undefined) {
    return pieceInvalid({
      pieceRoot: clashing.clause.pieceRoot,
      detail: `the rule ${clashing.ruleId} or its plugin namespace ${clashing.settings.pluginNamespace} is already selected from another piece`,
    });
  }
  return configured;
};

const pluginOf = (request: {
  readonly loaded: Result<unknown, { readonly detail: string }>;
  readonly configured: ConfiguredClause;
}): Outcome<SelectedClause> => {
  const pieceRoot = request.configured.clause.pieceRoot;
  if (request.loaded.outcome === "failed") {
    return pieceInvalid({ pieceRoot, detail: request.loaded.error.detail });
  }
  const parsed = eslintPluginModuleSchema.safeParse(request.loaded.value);
  if (!parsed.success) {
    return pieceInvalid({ pieceRoot, detail: parsed.error.message });
  }
  if (!Object.hasOwn(parsed.data.default.rules, request.configured.settings.rule)) {
    return pieceInvalid({
      pieceRoot,
      detail: `the plugin has no rule named ${request.configured.settings.rule}`,
    });
  }
  return { outcome: "ok", value: { ...request.configured, plugin: parsed.data.default } };
};

const loadedPlugin = (request: {
  readonly configured: ConfiguredClause;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<SelectedClause>> =>
  request.modules
    .load({ path: request.configured.modulePath })
    .then((loaded) => pluginOf({ loaded, configured: request.configured }));

const listedSelection = (request: {
  readonly configured: ConfiguredClause;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<readonly SelectedClause[]>> =>
  loadedPlugin(request).then((selected) => listedOutcome({ outcome: selected }));

const selectedClauses = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<readonly SelectedClause[]>> => {
  const configured = configuredSelection({ clauses: request.clauses, path: request.path });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  return Promise.all(
    configured.value.map((entry) => listedSelection({ configured: entry, modules: request.modules })),
  ).then((outcomes) => collectOutcomes({ outcomes }));
};

const namespaceLeaders = (request: {
  readonly configured: readonly ConfiguredClause[];
}): readonly ConfiguredClause[] =>
  request.configured.filter(
    (entry, index) =>
      request.configured.findIndex((other) => other.settings.pluginNamespace === entry.settings.pluginNamespace) ===
      index,
  );

const projectedPieceOf = (request: {
  readonly first: ConfiguredClause;
  readonly configured: readonly ConfiguredClause[];
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): ProjectedPiece => ({
  pluginNamespace: request.first.settings.pluginNamespace,
  pluginImport: pluginImportOf({
    path: request.path,
    repoRoot: request.repoRoot,
    pieceRoot: request.first.clause.pieceRoot,
    pluginModule: request.first.settings.pluginModule,
  }),
  clauses: request.configured
    .filter((entry) => entry.settings.pluginNamespace === request.first.settings.pluginNamespace)
    .map((entry) => ({ address: entry.clause.address, ruleId: entry.ruleId })),
});

const projectedPieces = (request: {
  readonly configured: readonly ConfiguredClause[];
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): readonly ProjectedPiece[] =>
  namespaceLeaders({ configured: request.configured }).map((first) => projectedPieceOf({ ...request, first }));

const generatedProjection = (request: {
  readonly configured: readonly ConfiguredClause[];
  readonly records: readonly ExceptionRecord[];
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): string =>
  projectionText({
    selectedPieces: projectedPieces({
      configured: request.configured,
      path: request.path,
      repoRoot: request.repoRoot,
    }),
    records: request.records,
  });

const fileRuleStates = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleId: string;
}): Promise<Outcome<CheckedFile["states"]>> =>
  request.query.ruleState({ file: request.file, ruleId: request.ruleId }).then((state) =>
    mappedOutcome({ outcome: state, map: (ruleState) => [{ ruleId: request.ruleId, state: ruleState }] }),
  );

const checkedQueriedFile = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
}): Promise<Outcome<readonly QueriedFile[]>> =>
  Promise.all(
    request.ruleIds.map((ruleId) => fileRuleStates({ query: request.query, file: request.file, ruleId })),
  ).then((outcomes) =>
    mappedOutcome({
      outcome: collectOutcomes({ outcomes }),
      map: (states): readonly QueriedFile[] => [{ file: request.file, ignored: "checked", states }],
    }),
  );

const queriedFileOf = (request: {
  readonly ignoredState: Outcome<IgnoredState>;
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
}): Promise<Outcome<readonly QueriedFile[]>> => {
  if (request.ignoredState.outcome === "failed") {
    return Promise.resolve(request.ignoredState);
  }
  if (request.ignoredState.value === "ignored") {
    return Promise.resolve({ outcome: "ok", value: [{ file: request.file, ignored: "ignored", states: [] }] });
  }
  return checkedQueriedFile({ query: request.query, file: request.file, ruleIds: request.ruleIds });
};

const queriedFile = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
}): Promise<Outcome<readonly QueriedFile[]>> =>
  request.query
    .ignoredState({ file: request.file })
    .then((ignoredState) => queriedFileOf({ ...request, ignoredState }));

const partitionedFiles = (request: { readonly queried: readonly QueriedFile[] }): QueriedFiles => ({
  ignored: request.queried.filter((entry) => entry.ignored === "ignored").map((entry) => entry.file),
  checked: request.queried
    .filter((entry) => entry.ignored === "checked")
    .map((entry) => ({ file: entry.file, states: entry.states })),
});

const queriedFiles = (request: {
  readonly query: QueryInstance;
  readonly files: readonly RepoPath[];
  readonly ruleIds: readonly string[];
}): Promise<Outcome<QueriedFiles>> =>
  Promise.all(
    request.files.map((file) => queriedFile({ query: request.query, file, ruleIds: request.ruleIds })),
  ).then((outcomes) =>
    mappedOutcome({
      outcome: collectOutcomes({ outcomes }),
      map: (queried) => partitionedFiles({ queried }),
    }),
  );

const severityOf = (request: {
  readonly checked: CheckedFile;
  readonly ruleId: string;
}): RuleState | undefined =>
  request.checked.states.find((entry) => entry.ruleId === request.ruleId)?.state;

const offEffect = (request: { readonly state: RuleState | undefined }): ProjectionEffect =>
  request.state?.state === "configured" && request.state.severity === 0 ? "in-effect" : "not-in-effect";

const ruleIdsOfRecord = (request: {
  readonly record: ExceptionRecord;
  readonly selected: readonly SelectedClause[];
}): readonly string[] =>
  request.selected
    .filter(
      (entry) =>
        sameClauseAddress({ left: entry.clause.address, right: request.record.clause }) === "same",
    )
    .map((entry) => entry.ruleId);

const governedChecked = (request: {
  readonly record: ExceptionRecord;
  readonly checked: readonly CheckedFile[];
}): readonly CheckedFile[] => {
  const record = request.record;
  if (record.kind === "clause-wide-carve-out") {
    return request.checked;
  }
  return request.checked.filter((checked) => checked.file === record.file);
};

const fileOffEffect = (request: {
  readonly checked: CheckedFile;
  readonly ruleIds: readonly string[];
}): ProjectionEffect =>
  request.ruleIds.every(
    (ruleId) => offEffect({ state: severityOf({ checked: request.checked, ruleId }) }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";

const recordEffect = (request: {
  readonly record: ExceptionRecord;
  readonly selected: readonly SelectedClause[];
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect => {
  const ruleIds = ruleIdsOfRecord({ record: request.record, selected: request.selected });
  return governedChecked({ record: request.record, checked: request.checked }).every(
    (checked) => fileOffEffect({ checked, ruleIds }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";
};

const ruleEnablement = (request: {
  readonly ruleId: string;
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect =>
  request.checked.length === 0 ||
  request.checked.some((checked) => severityOf({ checked, ruleId: request.ruleId })?.state === "configured")
    ? "in-effect"
    : "not-in-effect";

const enabledEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect =>
  request.selected.every(
    (entry) => ruleEnablement({ ruleId: entry.ruleId, checked: request.checked }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";

const exemptingEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect =>
  request.records.every(
    (record) => recordEffect({ record, selected: request.selected, checked: request.checked }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";

const projectionEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): ProjectionEffect => {
  const enabled = enabledEffect({ selected: request.selected, checked: request.queried.checked });
  const exempting = exemptingEffect({
    selected: request.selected,
    records: request.records,
    checked: request.queried.checked,
  });
  return enabled === "in-effect" && exempting === "in-effect" ? "in-effect" : "not-in-effect";
};

const ruleEnforcement = (request: {
  readonly checked: CheckedFile;
  readonly ruleId: string;
}): "enforced" | "weakened" => {
  const state = severityOf({ checked: request.checked, ruleId: request.ruleId });
  return state?.state === "configured" && state.severity === 2 ? "enforced" : "weakened";
};

const ignoreExceptions = (request: {
  readonly selected: readonly SelectedClause[];
  readonly file: RepoPath;
}): readonly NativeException[] =>
  request.selected.map((entry): NativeException => ({ kind: "ignore", clause: entry.clause.address, file: request.file }));

const overrideExceptions = (request: {
  readonly selected: readonly SelectedClause[];
  readonly checked: CheckedFile;
}): readonly NativeException[] =>
  request.selected
    .filter((entry) => ruleEnforcement({ checked: request.checked, ruleId: entry.ruleId }) === "weakened")
    .map(
      (entry): NativeException => ({
        kind: "config-override",
        clause: entry.clause.address,
        file: request.checked.file,
      }),
    );

const queryExceptions = (request: {
  readonly selected: readonly SelectedClause[];
  readonly queried: QueriedFiles;
}): readonly NativeException[] => [
  ...request.queried.ignored.flatMap((file) => ignoreExceptions({ selected: request.selected, file })),
  ...request.queried.checked.flatMap((checked) => overrideExceptions({ selected: request.selected, checked })),
];

const commentValueOf = (request: { readonly text: string }): string => {
  if (request.text.startsWith("//")) {
    return request.text.slice(2);
  }
  return request.text.startsWith("/*") && request.text.endsWith("*/")
    ? request.text.slice(2, -2)
    : request.text;
};

const inlineClauses = (request: {
  readonly text: string;
  readonly selected: readonly SelectedClause[];
}): readonly SelectedClause[] => {
  const parsed = parseInlineConfigComment({ text: commentValueOf({ text: request.text }) });
  switch (parsed.kind) {
    case "disable":
      return parsed.ruleIds.length === 0
        ? request.selected
        : request.selected.filter((entry) => parsed.ruleIds.includes(entry.ruleId));
    case "rule-config":
      return request.selected.filter((entry) => parsed.ruleIds.includes(entry.ruleId));
    case "unparseable-rule-config":
      return request.selected;
    case "not-an-exception":
      return [];
  }
};

const inlineExceptionKindOf = (request: {
  readonly messageId: string | undefined;
}): typeof INLINE_DISABLE | typeof INLINE_RULE_CONFIG | "not-inline" =>
  request.messageId === INLINE_DISABLE || request.messageId === INLINE_RULE_CONFIG
    ? request.messageId
    : "not-inline";

const inlineException = (request: {
  readonly message: LintedMessage;
  readonly file: RepoPath;
  readonly selected: readonly SelectedClause[];
}): Outcome<readonly NativeException[]> => {
  const message = request.message;
  const kind = inlineExceptionKindOf({ messageId: message.messageId });
  if (kind === "not-inline") {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: `${request.file}: ${message.message}` },
    };
  }
  return {
    outcome: "ok",
    value: inlineClauses({ text: message.message, selected: request.selected }).map(
      (entry): NativeException => ({
        kind,
        clause: entry.clause.address,
        file: request.file,
        line: message.line,
        text: message.message,
      }),
    ),
  };
};

const sourceLineOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly file: RepoPath;
  readonly line: number;
}): Outcome<string> => {
  const text = request.fileText.read({
    path: request.path.join({ segments: [request.repoRoot, request.file] }),
  });
  if (text.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", file: request.file, detail: text.error.detail },
    };
  }
  return { outcome: "ok", value: (text.value.split(LINE_BREAK)[request.line - 1] ?? "").trim() };
};

type LintFindings = { readonly hits: readonly Hit[]; readonly nativeExceptions: readonly NativeException[] };

const parseableFile = (request: {
  readonly linted: LintedFile;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): Outcome<RepoPath> => {
  const file = repoPathSchema.safeParse(
    request.path.relative({ from: request.repoRoot, to: request.linted.filePath }),
  );
  if (!file.success) {
    return {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: `ESLint linted ${request.linted.filePath}, which is outside the repository`,
      },
    };
  }
  const fatal = request.linted.messages.find((message) => message.fatal === true);
  if (fatal !== undefined) {
    return {
      outcome: "failed",
      error: { kind: "file-unparseable", file: file.data, detail: fatal.message },
    };
  }
  return { outcome: "ok", value: file.data };
};

const ruleFindings = (request: {
  readonly message: LintedMessage;
  readonly file: RepoPath;
  readonly clause: SelectedClause;
  readonly ports: EslintRunnerPorts;
  readonly repoRoot: AbsolutePath;
}): Outcome<readonly LintFindings[]> =>
  mappedOutcome({
    outcome: sourceLineOf({
      fileText: request.ports.fileText,
      path: request.ports.path,
      repoRoot: request.repoRoot,
      file: request.file,
      line: request.message.line,
    }),
    map: (snippet): readonly LintFindings[] => [
      {
        hits: [
          {
            clause: request.clause.clause.address,
            file: request.file,
            anchor: { line: request.message.line, column: request.message.column - 1 },
            snippet,
          },
        ],
        nativeExceptions: [],
      },
    ],
  });

const messageFindings = (request: {
  readonly message: LintedMessage;
  readonly file: RepoPath;
  readonly selected: readonly SelectedClause[];
  readonly ports: EslintRunnerPorts;
  readonly repoRoot: AbsolutePath;
}): Outcome<readonly LintFindings[]> => {
  if (request.message.ruleId === INLINE_CONFIG_RULE_ID) {
    return mappedOutcome({
      outcome: inlineException({ message: request.message, file: request.file, selected: request.selected }),
      map: (nativeExceptions): readonly LintFindings[] => [{ hits: [], nativeExceptions }],
    });
  }
  const clause = request.selected.find((entry) => entry.ruleId === request.message.ruleId);
  if (clause === undefined) {
    return { outcome: "ok", value: [] };
  }
  return ruleFindings({ ...request, clause });
};

const lintedFindings = (request: {
  readonly linted: LintedFile;
  readonly selected: readonly SelectedClause[];
  readonly ports: EslintRunnerPorts;
  readonly repoRoot: AbsolutePath;
}): Outcome<readonly LintFindings[]> => {
  const file = parseableFile({ linted: request.linted, path: request.ports.path, repoRoot: request.repoRoot });
  if (file.outcome === "failed") {
    return file;
  }
  return collectOutcomes({
    outcomes: request.linted.messages.map((message) =>
      messageFindings({
        message,
        file: file.value,
        selected: request.selected,
        ports: request.ports,
        repoRoot: request.repoRoot,
      }),
    ),
  });
};

const directoryOf = (request: { readonly path: RepoPath }): RepoPath | "repo-root" => {
  const directory = repoPathSchema.safeParse(request.path.split("/").slice(0, -1).join("/"));
  return directory.success ? directory.data : "repo-root";
};

const fileNameOf = (request: { readonly path: RepoPath }): string | undefined =>
  request.path.split("/").at(-1);

const trackedText = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly path: RepoPath;
}): Outcome<string> => {
  const text = request.fileText.read({ path: `${request.repoRoot}/${request.path}` });
  return text.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unreadable", file: request.path, detail: text.error.detail } }
    : text;
};

const filesNamed = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly name: string;
}): readonly RepoPath[] => request.trackedPaths.filter((path) => fileNameOf({ path }) === request.name);

const suppressionsFileExceptions = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly location: RepoPath;
  readonly selectedRules: readonly SelectedRule[];
}): Outcome<readonly NativeException[]> => {
  const text = trackedText({ fileText: request.fileText, repoRoot: request.repoRoot, path: request.location });
  if (text.outcome === "failed") {
    return text;
  }
  return suppressionEntriesOf({
    location: request.location,
    keysRelativeTo: directoryOf({ path: request.location }),
    text: text.value,
    selectedRules: request.selectedRules,
  });
};

const scannedPackageExceptions = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly packagePath: RepoPath;
  readonly scan: PackageJsonScan;
  readonly selectedRules: readonly SelectedRule[];
}): Outcome<readonly NativeException[]> =>
  collectOutcomes({
    outcomes: [
      { outcome: "ok", value: request.scan.nativeExceptions },
      ...request.scan.suppressionsLocations.map((scripted) =>
        scriptSuppressionEntries({
          fileText: request.fileText,
          repoRoot: request.repoRoot,
          location: scripted.location,
          keysRelativeTo: directoryOf({ path: request.packagePath }),
          selectedRules: request.selectedRules,
        }),
      ),
    ],
  });

const packageJsonExceptions = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly packagePath: RepoPath;
  readonly selectedRules: readonly SelectedRule[];
}): Outcome<readonly NativeException[]> => {
  const text = trackedText({ fileText: request.fileText, repoRoot: request.repoRoot, path: request.packagePath });
  if (text.outcome === "failed") {
    return text;
  }
  const scan = scanPackageJson({
    path: request.packagePath,
    text: text.value,
    selectedRules: request.selectedRules,
  });
  if (scan.outcome === "failed") {
    return scan;
  }
  return scannedPackageExceptions({ ...request, scan: scan.value });
};

const trackedExceptions = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
  readonly selectedRules: readonly SelectedRule[];
}): Outcome<readonly NativeException[]> =>
  collectOutcomes({
    outcomes: [
      ...filesNamed({ trackedPaths: request.trackedPaths, name: SUPPRESSIONS_FILE_NAME }).map((location) =>
        suppressionsFileExceptions({ ...request, location }),
      ),
      ...filesNamed({ trackedPaths: request.trackedPaths, name: PACKAGE_JSON_NAME }).map((packagePath) =>
        packageJsonExceptions({ ...request, packagePath }),
      ),
    ],
  });

const reportWith = (request: {
  readonly projection: EmbeddedRunReport["projection"];
}): Outcome<EmbeddedRunReport> => ({
  outcome: "ok",
  value: { hits: [], nativeExceptions: [], projection: request.projection },
});

const ruleIdsOf = (request: { readonly selected: readonly SelectedClause[] }): readonly string[] =>
  request.selected.map((entry) => entry.ruleId);

const pluginsByNamespace = (request: {
  readonly selected: readonly SelectedClause[];
}): Readonly<Record<string, LoadedEslintPlugin>> =>
  Object.fromEntries(request.selected.map((entry) => [entry.settings.pluginNamespace, entry.plugin]));

const selectedRulesOf = (request: { readonly selected: readonly SelectedClause[] }): readonly SelectedRule[] =>
  request.selected.map((entry) => ({ ruleId: entry.ruleId, clause: entry.clause.address }));

const recordsUnderCheck = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly checked: readonly CheckedFile[];
}): readonly ExceptionRecord[] =>
  request.records.filter(
    (record) =>
      record.kind === "clause-wide-carve-out" ||
      request.checked.some((checked) => checked.file === record.file),
  );

const governedLint = (request: {
  readonly run: RecordedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly eslint: EslintPort;
}): Promise<Outcome<readonly LintedFile[]>> => {
  if (request.run.files.length === 0 || request.selected.length === 0) {
    return Promise.resolve({ outcome: "ok", value: [] });
  }
  return request.eslint
    .createGovernanceInstance({
      repoRoot: request.run.repoRoot,
      plugins: pluginsByNamespace({ selected: request.selected }),
      ruleIds: ruleIdsOf({ selected: request.selected }),
    })
    .lintFiles({ files: request.run.files });
};

const governedReport = (request: {
  readonly run: RecordedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly projection: "current" | "out-of-date";
  readonly ports: EslintRunnerPorts;
  readonly queried: QueriedFiles;
  readonly lintedFiles: readonly LintedFile[];
}): Outcome<EmbeddedRunReport> => {
  const findings = collectOutcomes({
    outcomes: request.lintedFiles.map((linted) =>
      lintedFindings({ linted, selected: request.selected, ports: request.ports, repoRoot: request.run.repoRoot }),
    ),
  });
  if (findings.outcome === "failed") {
    return findings;
  }
  const tracked = trackedExceptions({
    fileText: request.ports.fileText,
    repoRoot: request.run.repoRoot,
    trackedPaths: request.run.trackedPaths,
    selectedRules: selectedRulesOf({ selected: request.selected }),
  });
  if (tracked.outcome === "failed") {
    return tracked;
  }
  return {
    outcome: "ok",
    value: {
      hits: findings.value.flatMap((found) => found.hits),
      nativeExceptions: [
        ...queryExceptions({ selected: request.selected, queried: request.queried }),
        ...findings.value.flatMap((found) => found.nativeExceptions),
        ...tracked.value,
      ],
      projection: request.projection,
    },
  };
};

const lintedReport = (request: {
  readonly run: RecordedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly projection: "current" | "out-of-date";
  readonly ports: EslintRunnerPorts;
  readonly queried: QueriedFiles;
}): Promise<Outcome<EmbeddedRunReport>> =>
  governedLint({ run: request.run, selected: request.selected, eslint: request.ports.eslint }).then(
    (lintedFiles) =>
      lintedFiles.outcome === "failed" ? lintedFiles : governedReport({ ...request, lintedFiles: lintedFiles.value }),
  );

const queriedReport = (request: {
  readonly run: RecordedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly projection: "current" | "out-of-date";
  readonly ports: EslintRunnerPorts;
  readonly queried: Outcome<QueriedFiles>;
}): Promise<Outcome<EmbeddedRunReport>> => {
  if (request.queried.outcome === "failed") {
    return Promise.resolve(request.queried);
  }
  const queried = request.queried.value;
  const records = recordsUnderCheck({ records: request.run.records, checked: queried.checked });
  if (projectionEffect({ selected: request.selected, records, queried }) === "not-in-effect") {
    return Promise.resolve(reportWith({ projection: "not-included" }));
  }
  return lintedReport({ ...request, queried });
};

const governedRun = (request: {
  readonly run: RecordedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly projection: "current" | "out-of-date";
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<EmbeddedRunReport>> =>
  queriedFiles({
    query: request.ports.eslint.createQueryInstance({ repoRoot: request.run.repoRoot }),
    files: request.run.files,
    ruleIds: ruleIdsOf({ selected: request.selected }),
  }).then((queried) => queriedReport({ ...request, queried }));

const presentProjectionState = (request: {
  readonly current: CurrentProjection;
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): "current" | "out-of-date" =>
  projectionState({
    current: request.current,
    generated: generatedProjection({
      configured: request.selected,
      records: request.records,
      path: request.path,
      repoRoot: request.repoRoot,
    }),
  }) === "current"
    ? "current"
    : "out-of-date";

const selectedRun = (request: {
  readonly run: RecordedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<EmbeddedRunReport>> => {
  const current = currentProjection({ fileText: request.ports.fileText, repoRoot: request.run.repoRoot });
  if (current.outcome === "failed") {
    return Promise.resolve(current);
  }
  if (current.value.presence === "absent") {
    return Promise.resolve(reportWith({ projection: "missing" }));
  }
  return governedRun({
    ...request,
    projection: presentProjectionState({
      current: current.value,
      selected: request.selected,
      records: request.run.records,
      path: request.ports.path,
      repoRoot: request.run.repoRoot,
    }),
  });
};

const lintedSourceCases = (request: {
  readonly selected: Outcome<SelectedClause>;
  readonly cwd: AbsolutePath;
  readonly cases: readonly SourceCase[];
  readonly eslint: EslintPort;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  if (request.selected.outcome === "failed") {
    return Promise.resolve(request.selected);
  }
  return request.eslint.lintSourceCases({
    cwd: request.cwd,
    plugin: request.selected.value.plugin,
    pluginNamespace: request.selected.value.settings.pluginNamespace,
    rule: request.selected.value.settings.rule,
    cases: request.cases,
  });
};

const conformedCases = (request: {
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  const configured = configuredClause({ clause: request.clause, path: request.ports.path });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  const cwd = absolutePathSchema.safeParse(request.clause.pieceRoot);
  if (!cwd.success) {
    return Promise.resolve(pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: cwd.error.message }));
  }
  return loadedPlugin({ configured: configured.value, modules: request.ports.modules }).then((selected) =>
    lintedSourceCases({ selected, cwd: cwd.data, cases: request.cases, eslint: request.ports.eslint }),
  );
};

const projectedWrite = (request: {
  readonly request: ProjectionRequest;
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<ProjectionWrite>> => {
  const configured = configuredSelection({ clauses: request.request.clauses, path: request.ports.path });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  return Promise.resolve(
    writeProjection({
      fileText: request.ports.fileText,
      repoRoot: request.request.repoRoot,
      text: generatedProjection({
        configured: configured.value,
        records: request.request.records,
        path: request.ports.path,
        repoRoot: request.request.repoRoot,
      }),
    }),
  );
};

export const createEslintRunner = (ports: EslintRunnerPorts): EmbeddedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: (request) =>
    selectedClauses({ clauses: request.clauses, path: ports.path, modules: ports.modules }).then((selected) =>
      selected.outcome === "failed" ? selected : selectedRun({ run: request, selected: selected.value, ports }),
    ),
  conform: (request) => conformedCases({ clause: request.clause, cases: request.cases, ports }),
  project: (request) => projectedWrite({ request, ports }),
});
