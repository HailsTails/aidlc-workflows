import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { EmbeddedRunReport } from "../../../core/mechanism-port/embedded-run-report-schema.ts";
import type { EmbeddedRunner } from "../../../core/mechanism-port/embedded-runner-module-schema.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type {
  RunnerClause,
  RunRequest,
} from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Hit, NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
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
import { scanPackageJson, type SelectedRule } from "./package-script-scanner.ts";
import {
  PROJECTION_PATH,
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

const collectOutcomes = <Value>(request: {
  readonly outcomes: readonly Outcome<readonly Value[]>[];
}): Outcome<readonly Value[]> =>
  request.outcomes.reduce<Outcome<readonly Value[]>>(
    (gathered, next) => {
      if (gathered.outcome === "failed") {
        return gathered;
      }
      return next.outcome === "failed"
        ? next
        : { outcome: "ok", value: [...gathered.value, ...next.value] };
    },
    { outcome: "ok", value: [] },
  );

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

const configuredSelection = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
}): Outcome<readonly ConfiguredClause[]> => {
  const configured = collectOutcomes({
    outcomes: request.clauses.map((clause): Outcome<readonly ConfiguredClause[]> => {
      const one = configuredClause({ clause, path: request.path });
      return one.outcome === "failed" ? one : { outcome: "ok", value: [one.value] };
    }),
  });
  if (configured.outcome === "failed") {
    return configured;
  }
  const clashing = configured.value.find((entry, index) =>
    configured.value
      .slice(0, index)
      .some(
        (earlier) =>
          earlier.ruleId === entry.ruleId ||
          (earlier.settings.pluginNamespace === entry.settings.pluginNamespace &&
            earlier.modulePath !== entry.modulePath),
      ),
  );
  if (clashing !== undefined) {
    return pieceInvalid({
      pieceRoot: clashing.clause.pieceRoot,
      detail: `the rule ${clashing.ruleId} or its plugin namespace ${clashing.settings.pluginNamespace} is already selected from another piece`,
    });
  }
  return configured;
};

const loadedPlugin = (request: {
  readonly configured: ConfiguredClause;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<SelectedClause>> =>
  request.modules.load({ path: request.configured.modulePath }).then((loaded) => {
    const pieceRoot = request.configured.clause.pieceRoot;
    if (loaded.outcome === "failed") {
      return pieceInvalid({ pieceRoot, detail: loaded.error.detail });
    }
    const parsed = eslintPluginModuleSchema.safeParse(loaded.value);
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
  });

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
    configured.value.map((entry) =>
      loadedPlugin({ configured: entry, modules: request.modules }).then(
        (selected): Outcome<readonly SelectedClause[]> =>
          selected.outcome === "failed" ? selected : { outcome: "ok", value: [selected.value] },
      ),
    ),
  ).then((outcomes) => collectOutcomes({ outcomes }));
};

const projectedPieces = (request: {
  readonly configured: readonly ConfiguredClause[];
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): readonly ProjectedPiece[] =>
  request.configured
    .filter(
      (entry, index) =>
        request.configured.findIndex(
          (other) => other.settings.pluginNamespace === entry.settings.pluginNamespace,
        ) === index,
    )
    .map((first) => ({
      pluginNamespace: first.settings.pluginNamespace,
      pluginImport: pluginImportOf({
        path: request.path,
        repoRoot: request.repoRoot,
        pieceRoot: first.clause.pieceRoot,
        pluginModule: first.settings.pluginModule,
      }),
      clauses: request.configured
        .filter((entry) => entry.settings.pluginNamespace === first.settings.pluginNamespace)
        .map((entry) => ({ address: entry.clause.address, ruleId: entry.ruleId })),
    }));

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

const queriedFiles = (request: {
  readonly query: QueryInstance;
  readonly files: readonly RepoPath[];
  readonly ruleIds: readonly string[];
}): Promise<Outcome<QueriedFiles>> =>
  Promise.all(
    request.files.map((file) =>
      request.query.ignoredState({ file }).then(
        (ignoredState): Promise<Outcome<readonly QueriedFile[]>> => {
          if (ignoredState.outcome === "failed") {
            return Promise.resolve(ignoredState);
          }
          if (ignoredState.value === "ignored") {
            return Promise.resolve({ outcome: "ok", value: [{ file, ignored: "ignored", states: [] }] });
          }
          return Promise.all(
            request.ruleIds.map((ruleId) =>
              request.query.ruleState({ file, ruleId }).then(
                (state): Outcome<CheckedFile["states"]> =>
                  state.outcome === "failed"
                    ? state
                    : { outcome: "ok", value: [{ ruleId, state: state.value }] },
              ),
            ),
          ).then((outcomes) => {
            const states = collectOutcomes({ outcomes });
            return states.outcome === "failed"
              ? states
              : { outcome: "ok", value: [{ file, ignored: "checked", states: states.value }] };
          });
        },
      ),
    ),
  ).then((outcomes): Outcome<QueriedFiles> => {
    const queried = collectOutcomes({ outcomes });
    if (queried.outcome === "failed") {
      return queried;
    }
    return {
      outcome: "ok",
      value: {
        ignored: queried.value.filter((entry) => entry.ignored === "ignored").map((entry) => entry.file),
        checked: queried.value
          .filter((entry) => entry.ignored === "checked")
          .map((entry) => ({ file: entry.file, states: entry.states })),
      },
    };
  });

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

const recordEffect = (request: {
  readonly record: ExceptionRecord;
  readonly selected: readonly SelectedClause[];
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect => {
  const ruleIds = ruleIdsOfRecord({ record: request.record, selected: request.selected });
  const record = request.record;
  const governed =
    record.kind === "clause-wide-carve-out"
      ? request.checked
      : request.checked.filter((checked) => checked.file === record.file);
  return governed.every((checked) =>
    ruleIds.every((ruleId) => offEffect({ state: severityOf({ checked, ruleId }) }) === "in-effect"),
  )
    ? "in-effect"
    : "not-in-effect";
};

const projectionEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): ProjectionEffect => {
  const enabled = request.selected.every(
    (entry) =>
      request.queried.checked.length === 0 ||
      request.queried.checked.some(
        (checked) => severityOf({ checked, ruleId: entry.ruleId })?.state === "configured",
      ),
  );
  const exempting = request.records.every(
    (record) =>
      recordEffect({ record, selected: request.selected, checked: request.queried.checked }) ===
      "in-effect",
  );
  return enabled && exempting ? "in-effect" : "not-in-effect";
};

const queryExceptions = (request: {
  readonly selected: readonly SelectedClause[];
  readonly queried: QueriedFiles;
}): readonly NativeException[] => [
  ...request.queried.ignored.flatMap((file) =>
    request.selected.map((entry): NativeException => ({ kind: "ignore", clause: entry.clause.address, file })),
  ),
  ...request.queried.checked.flatMap((checked) =>
    request.selected
      .filter((entry) => {
        const state = severityOf({ checked, ruleId: entry.ruleId });
        return !(state?.state === "configured" && state.severity === 2);
      })
      .map((entry): NativeException => ({
        kind: "config-override",
        clause: entry.clause.address,
        file: checked.file,
      })),
  ),
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

const inlineException = (request: {
  readonly message: LintedMessage;
  readonly file: RepoPath;
  readonly selected: readonly SelectedClause[];
}): Outcome<readonly NativeException[]> => {
  const message = request.message;
  const clauses = inlineClauses({ text: message.message, selected: request.selected });
  switch (message.messageId) {
    case INLINE_DISABLE:
      return {
        outcome: "ok",
        value: clauses.map((entry) => ({
          kind: INLINE_DISABLE,
          clause: entry.clause.address,
          file: request.file,
          line: message.line,
          text: message.message,
        })),
      };
    case INLINE_RULE_CONFIG:
      return {
        outcome: "ok",
        value: clauses.map((entry) => ({
          kind: INLINE_RULE_CONFIG,
          clause: entry.clause.address,
          file: request.file,
          line: message.line,
          text: message.message,
        })),
      };
    default:
      return {
        outcome: "failed",
        error: { kind: "tool-failed", detail: `${request.file}: ${message.message}` },
      };
  }
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

const lintedFindings = (request: {
  readonly linted: LintedFile;
  readonly selected: readonly SelectedClause[];
  readonly ports: EslintRunnerPorts;
  readonly repoRoot: AbsolutePath;
}): Outcome<readonly LintFindings[]> => {
  const file = repoPathSchema.safeParse(
    request.ports.path.relative({ from: request.repoRoot, to: request.linted.filePath }),
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
  return collectOutcomes({
    outcomes: request.linted.messages.map((message): Outcome<readonly LintFindings[]> => {
      if (message.ruleId === INLINE_CONFIG_RULE_ID) {
        const inline = inlineException({ message, file: file.data, selected: request.selected });
        return inline.outcome === "failed"
          ? inline
          : { outcome: "ok", value: [{ hits: [], nativeExceptions: inline.value }] };
      }
      const clause = request.selected.find((entry) => entry.ruleId === message.ruleId);
      if (clause === undefined) {
        return { outcome: "ok", value: [] };
      }
      const snippet = sourceLineOf({
        fileText: request.ports.fileText,
        path: request.ports.path,
        repoRoot: request.repoRoot,
        file: file.data,
        line: message.line,
      });
      if (snippet.outcome === "failed") {
        return snippet;
      }
      return {
        outcome: "ok",
        value: [
          {
            hits: [
              {
                clause: clause.clause.address,
                file: file.data,
                anchor: { line: message.line, column: message.column - 1 },
                snippet: snippet.value,
              },
            ],
            nativeExceptions: [],
          },
        ],
      };
    }),
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

const trackedExceptions = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
  readonly selectedRules: readonly SelectedRule[];
}): Outcome<readonly NativeException[]> =>
  collectOutcomes({
    outcomes: [
      ...request.trackedPaths
        .filter((path) => fileNameOf({ path }) === SUPPRESSIONS_FILE_NAME)
        .map((location) => {
          const text = trackedText({ fileText: request.fileText, repoRoot: request.repoRoot, path: location });
          return text.outcome === "failed"
            ? text
            : suppressionEntriesOf({
                location,
                keysRelativeTo: directoryOf({ path: location }),
                text: text.value,
                selectedRules: request.selectedRules,
              });
        }),
      ...request.trackedPaths
        .filter((path) => fileNameOf({ path }) === PACKAGE_JSON_NAME)
        .map((packagePath): Outcome<readonly NativeException[]> => {
          const text = trackedText({ fileText: request.fileText, repoRoot: request.repoRoot, path: packagePath });
          if (text.outcome === "failed") {
            return text;
          }
          const scan = scanPackageJson({
            path: packagePath,
            text: text.value,
            selectedRules: request.selectedRules,
          });
          if (scan.outcome === "failed") {
            return scan;
          }
          return collectOutcomes({
            outcomes: [
              { outcome: "ok", value: scan.value.nativeExceptions },
              ...scan.value.suppressionsLocations.map((scripted) =>
                scriptSuppressionEntries({
                  fileText: request.fileText,
                  repoRoot: request.repoRoot,
                  location: scripted.location,
                  keysRelativeTo: directoryOf({ path: packagePath }),
                  selectedRules: request.selectedRules,
                }),
              ),
            ],
          });
        }),
    ],
  });

const currentProjection = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
}): Outcome<{ readonly presence: "absent" } | { readonly presence: "present"; readonly text: string }> => {
  const projectionFile = `${request.repoRoot}/${PROJECTION_PATH}`;
  if (request.fileText.exists({ path: projectionFile }) === "absent") {
    return { outcome: "ok", value: { presence: "absent" } };
  }
  const text = request.fileText.read({ path: projectionFile });
  return text.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unreadable", file: PROJECTION_PATH, detail: text.error.detail } }
    : { outcome: "ok", value: { presence: "present", text: text.value } };
};

const reportWith = (request: {
  readonly projection: EmbeddedRunReport["projection"];
}): Outcome<EmbeddedRunReport> => ({
  outcome: "ok",
  value: { hits: [], nativeExceptions: [], projection: request.projection },
});

const governedRun = (request: {
  readonly run: RecordedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly projection: "current" | "out-of-date";
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<EmbeddedRunReport>> => {
  const ruleIds = request.selected.map((entry) => entry.ruleId);
  const query = request.ports.eslint.createQueryInstance({ repoRoot: request.run.repoRoot });
  return queriedFiles({ query, files: request.run.files, ruleIds }).then((queried) => {
    if (queried.outcome === "failed") {
      return queried;
    }
    const recordsUnderCheck = request.run.records.filter(
      (record) =>
        record.kind === "clause-wide-carve-out" ||
        queried.value.checked.some((checked) => checked.file === record.file),
    );
    if (
      projectionEffect({ selected: request.selected, records: recordsUnderCheck, queried: queried.value }) ===
      "not-in-effect"
    ) {
      return reportWith({ projection: "not-included" });
    }
    const governance = request.ports.eslint.createGovernanceInstance({
      repoRoot: request.run.repoRoot,
      plugins: Object.fromEntries(
        request.selected.map((entry) => [entry.settings.pluginNamespace, entry.plugin]),
      ),
      ruleIds,
    });
    return governance.lintFiles({ files: request.run.files }).then((lintedFiles): Outcome<EmbeddedRunReport> => {
      if (lintedFiles.outcome === "failed") {
        return lintedFiles;
      }
      const findings = collectOutcomes({
        outcomes: lintedFiles.value.map((linted) =>
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
        selectedRules: request.selected.map((entry) => ({ ruleId: entry.ruleId, clause: entry.clause.address })),
      });
      if (tracked.outcome === "failed") {
        return tracked;
      }
      return {
        outcome: "ok",
        value: {
          hits: findings.value.flatMap((found) => found.hits),
          nativeExceptions: [
            ...queryExceptions({ selected: request.selected, queried: queried.value }),
            ...findings.value.flatMap((found) => found.nativeExceptions),
            ...tracked.value,
          ],
          projection: request.projection,
        },
      };
    });
  });
};

export const createEslintRunner = (ports: EslintRunnerPorts): EmbeddedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: (request) =>
    selectedClauses({ clauses: request.clauses, path: ports.path, modules: ports.modules }).then(
      (selected) => {
        if (selected.outcome === "failed") {
          return selected;
        }
        const current = currentProjection({ fileText: ports.fileText, repoRoot: request.repoRoot });
        if (current.outcome === "failed") {
          return current;
        }
        if (current.value.presence === "absent") {
          return reportWith({ projection: "missing" });
        }
        const state = projectionState({
          current: current.value,
          generated: generatedProjection({
            configured: selected.value,
            records: request.records,
            path: ports.path,
            repoRoot: request.repoRoot,
          }),
        });
        return governedRun({
          run: request,
          selected: selected.value,
          projection: state === "current" ? "current" : "out-of-date",
          ports,
        });
      },
    ),
  conform: (request) => {
    const configured = configuredClause({ clause: request.clause, path: ports.path });
    if (configured.outcome === "failed") {
      return Promise.resolve(configured);
    }
    const cwd = absolutePathSchema.safeParse(request.clause.pieceRoot);
    if (!cwd.success) {
      return Promise.resolve(
        pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: cwd.error.message }),
      );
    }
    return loadedPlugin({ configured: configured.value, modules: ports.modules }).then((selected) =>
      selected.outcome === "failed"
        ? selected
        : ports.eslint.lintSourceCases({
            cwd: cwd.data,
            plugin: selected.value.plugin,
            pluginNamespace: selected.value.settings.pluginNamespace,
            rule: selected.value.settings.rule,
            cases: request.cases,
          }),
    );
  },
  project: (request) => {
    const configured = configuredSelection({ clauses: request.clauses, path: ports.path });
    if (configured.outcome === "failed") {
      return Promise.resolve(configured);
    }
    return Promise.resolve(
      writeProjection({
        fileText: ports.fileText,
        repoRoot: request.repoRoot,
        text: generatedProjection({
          configured: configured.value,
          records: request.records,
          path: ports.path,
          repoRoot: request.repoRoot,
        }),
      }),
    );
  },
});
