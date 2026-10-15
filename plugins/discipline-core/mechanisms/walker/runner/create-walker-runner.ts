import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type {
  RunnerClause,
  StandaloneRunner,
} from "../../../core/mechanism-port/runner-module-schema.ts";
import type { CaseVerdict, Hit } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AnchorKind } from "../../../core/values/anchor.ts";
import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import {
  anchoredSnippetsSchema,
  type LoadedWalkerCheck,
  pathVerdictSchema,
  walkerPieceModuleSchema,
  walkerPieceSettingsSchema,
} from "./walker-check-schema.ts";
import type { AnchoredSnippet, ParsePort } from "./walker-check.ts";

type SelectedCheck = {
  readonly address: ClauseAddress;
  readonly anchorKind: AnchorKind;
  readonly pieceRoot: string;
  readonly order: number;
  readonly check: LoadedWalkerCheck;
};

type SelectedModule = {
  readonly clause: RunnerClause;
  readonly order: number;
  readonly modulePath: string;
};

type OrderedHit = { readonly hit: Hit; readonly order: number };

type Outcome<Value> = Result<Value, RunnerFailure>;

type WalkerPorts<Api, Tree, Node> = {
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly parse: ParsePort<Api, Tree, Node>;
};

type SourceRequest = () => Outcome<string>;

const DECLARATION_FILE_ENDINGS: readonly string[] = [".d.ts", ".d.mts", ".d.cts"];

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: request.pieceRoot, detail: request.detail },
});

const thrownDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

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

const selectModules = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
}): Outcome<readonly SelectedModule[]> =>
  collectOutcomes({
    outcomes: request.clauses.map((clause, order): Outcome<readonly SelectedModule[]> => {
      const settings = walkerPieceSettingsSchema.safeParse(clause.settings);
      return settings.success
        ? {
            outcome: "ok",
            value: [
              {
                clause,
                order,
                modulePath: request.path.join({
                  segments: [clause.pieceRoot, settings.data.module],
                }),
              },
            ],
          }
        : pieceInvalid({ pieceRoot: clause.pieceRoot, detail: settings.error.message });
    }),
  });

const loadModule = (request: {
  readonly modulePath: string;
  readonly pieceRoot: string;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<LoadedWalkerCheck>> =>
  request.modules.load({ path: request.modulePath }).then((loaded) => {
    if (loaded.outcome === "failed") {
      return pieceInvalid({ pieceRoot: request.pieceRoot, detail: loaded.error.detail });
    }
    const parsed = walkerPieceModuleSchema.safeParse(loaded.value);
    return parsed.success
      ? { outcome: "ok", value: parsed.data.check }
      : pieceInvalid({ pieceRoot: request.pieceRoot, detail: parsed.error.message });
  });

const loadChecks = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
}): Promise<Outcome<readonly SelectedCheck[]>> => {
  const selected = selectModules({ clauses: request.clauses, path: request.path });
  if (selected.outcome === "failed") {
    return Promise.resolve(selected);
  }
  const firstPerModule = selected.value.filter(
    (entry, index) =>
      selected.value.findIndex((other) => other.modulePath === entry.modulePath) === index,
  );
  return Promise.all(
    firstPerModule.map((first) =>
      loadModule({
        modulePath: first.modulePath,
        pieceRoot: first.clause.pieceRoot,
        modules: request.modules,
      }).then((loaded): Outcome<readonly SelectedCheck[]> => {
        if (loaded.outcome === "failed") {
          return loaded;
        }
        return {
          outcome: "ok",
          value: selected.value
            .filter((entry) => entry.modulePath === first.modulePath)
            .map((entry) => ({
              address: entry.clause.address,
              anchorKind: entry.clause.anchor,
              pieceRoot: entry.clause.pieceRoot,
              order: entry.order,
              check: loaded.value,
            })),
        };
      }),
    ),
  ).then((outcomes) => collectOutcomes({ outcomes }));
};

const lineStartsOf = (request: { readonly source: string }): readonly number[] => [
  0,
  ...[...request.source.matchAll(/\r\n|[\r\n\u2028\u2029]/g)].map(
    (lineBreak) => lineBreak.index + lineBreak[0].length,
  ),
];

const anchorWithin = (request: {
  readonly source: string;
  readonly lineStarts: readonly number[];
  readonly position: number;
}): AnchoredSnippet => {
  const position = Math.min(Math.max(request.position, 0), request.source.length);
  const lineIndex = request.lineStarts.findLastIndex((start) => start <= position);
  const lineStart = request.lineStarts[lineIndex] ?? 0;
  const nextLineStart = request.lineStarts[lineIndex + 1] ?? request.source.length;
  return {
    anchor: { line: lineIndex + 1, column: position - lineStart },
    snippet: request.source.slice(lineStart, nextLineStart).trim(),
  };
};

const settleCheck = <Value>(request: {
  readonly pieceRoot: string;
  readonly call: () => unknown;
  readonly accept: (returned: unknown) => Outcome<Value>;
}): Promise<Outcome<Value>> =>
  Promise.resolve()
    .then(request.call)
    .then(request.accept, (thrown: unknown) =>
      pieceInvalid({ pieceRoot: request.pieceRoot, detail: thrownDetail({ thrown }) }),
    );

const pathHits = (request: {
  readonly file: RepoPath;
  readonly checks: readonly SelectedCheck[];
}): Promise<Outcome<readonly OrderedHit[]>> =>
  Promise.all(
    request.checks.map((selected) =>
      settleCheck({
        pieceRoot: selected.pieceRoot,
        call: () => selected.check.inspect({ file: request.file }),
        accept: (returned): Outcome<readonly OrderedHit[]> => {
          const verdict = pathVerdictSchema.safeParse(returned);
          if (!verdict.success) {
            return pieceInvalid({ pieceRoot: selected.pieceRoot, detail: verdict.error.message });
          }
          return {
            outcome: "ok",
            value:
              verdict.data === "violates"
                ? [
                    {
                      hit: {
                        clause: selected.address,
                        file: request.file,
                        anchor: { line: 1, column: 0 },
                        snippet: request.file,
                      },
                      order: selected.order,
                    },
                  ]
                : [],
          };
        },
      }),
    ),
  ).then((outcomes) => collectOutcomes({ outcomes }));

const syntaxHits = <Api, Tree, Node>(request: {
  readonly file: RepoPath;
  readonly source: SourceRequest;
  readonly checks: readonly SelectedCheck[];
  readonly parse: ParsePort<Api, Tree, Node>;
}): Promise<Outcome<readonly OrderedHit[]>> => {
  if (request.checks.length === 0 || DECLARATION_FILE_ENDINGS.some((ending) => request.file.endsWith(ending))) {
    return Promise.resolve({ outcome: "ok", value: [] });
  }
  const source = request.source();
  if (source.outcome === "failed") {
    return Promise.resolve(source);
  }
  const tree = request.parse.parse({ fileName: request.file, source: source.value });
  const everyNode = (node: Tree | Node): readonly Node[] =>
    request.parse.children({ node }).flatMap((child) => [child, ...everyNode(child)]);
  const nodes = everyNode(tree);
  const lineStarts = lineStartsOf({ source: source.value });
  const anchorAt = (anchorRequest: { readonly position: number }): AnchoredSnippet =>
    anchorWithin({ source: source.value, lineStarts, position: anchorRequest.position });
  return Promise.all(
    request.checks.flatMap((selected) =>
      nodes.map((node) =>
        settleCheck({
          pieceRoot: selected.pieceRoot,
          call: () =>
            selected.check.inspect({
              node,
              tree,
              syntaxApi: request.parse.syntaxApi,
              anchorKind: selected.anchorKind,
              anchorAt,
            }),
          accept: (returned): Outcome<readonly OrderedHit[]> => {
            const found = anchoredSnippetsSchema.safeParse(returned);
            return found.success
              ? {
                  outcome: "ok",
                  value: found.data.map((anchored) => ({
                    hit: {
                      clause: selected.address,
                      file: request.file,
                      anchor: anchored.anchor,
                      snippet: anchored.snippet,
                    },
                    order: selected.order,
                  })),
                }
              : pieceInvalid({ pieceRoot: selected.pieceRoot, detail: found.error.message });
          },
        }),
      ),
    ),
  ).then((outcomes) => collectOutcomes({ outcomes }));
};

const inSourceOrder = (request: { readonly hits: readonly OrderedHit[] }): readonly Hit[] =>
  [...request.hits]
    .sort(
      (left, right) =>
        left.hit.anchor.line - right.hit.anchor.line ||
        left.hit.anchor.column - right.hit.anchor.column ||
        left.order - right.order,
    )
    .map((ordered) => ordered.hit);

const hitsForFile = <Api, Tree, Node>(request: {
  readonly file: RepoPath;
  readonly source: SourceRequest;
  readonly checks: readonly SelectedCheck[];
  readonly parse: ParsePort<Api, Tree, Node>;
}): Promise<Outcome<readonly Hit[]>> =>
  pathHits({
    file: request.file,
    checks: request.checks.filter((selected) => selected.check.kind === "path"),
  }).then((fromPaths) => {
    if (fromPaths.outcome === "failed") {
      return fromPaths;
    }
    return syntaxHits({
      file: request.file,
      source: request.source,
      checks: request.checks.filter((selected) => selected.check.kind === "syntax"),
      parse: request.parse,
    }).then((fromSyntax): Outcome<readonly Hit[]> => {
      if (fromSyntax.outcome === "failed") {
        return fromSyntax;
      }
      return {
        outcome: "ok",
        value: inSourceOrder({ hits: [...fromPaths.value, ...fromSyntax.value] }),
      };
    });
  });

const inSequence = <Walked, Value>(request: {
  readonly sequence: readonly Walked[];
  readonly step: (walked: Walked) => Promise<Outcome<readonly Value[]>>;
}): Promise<Outcome<readonly Value[]>> =>
  request.sequence.reduce<Promise<Outcome<readonly Value[]>>>(
    (pending, walked) =>
      pending.then((gathered) =>
        gathered.outcome === "failed"
          ? gathered
          : request
              .step(walked)
              .then((next) => collectOutcomes({ outcomes: [gathered, next] })),
      ),
    Promise.resolve({ outcome: "ok", value: [] }),
  );

export const createWalkerRunner = <Api, Tree, Node>(
  options: WalkerPorts<Api, Tree, Node>,
): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: (request) =>
    loadChecks({ clauses: request.clauses, modules: options.modules, path: options.path }).then(
      (loaded) =>
        loaded.outcome === "failed"
          ? loaded
          : inSequence({
              sequence: request.files,
              step: (file) =>
                hitsForFile({
                  file,
                  source: () => {
                    const text = options.fileText.read({
                      path: options.path.join({ segments: [request.repoRoot, file] }),
                    });
                    return text.outcome === "ok"
                      ? text
                      : {
                          outcome: "failed",
                          error: { kind: "file-unreadable", file, detail: text.error.detail },
                        };
                  },
                  checks: loaded.value,
                  parse: options.parse,
                }),
            }),
    ),
  conform: (request) =>
    loadChecks({ clauses: [request.clause], modules: options.modules, path: options.path }).then(
      (loaded) =>
        loaded.outcome === "failed"
          ? loaded
          : inSequence({
              sequence: request.cases,
              step: (sourceCase) =>
                hitsForFile({
                  file: sourceCase.fileName,
                  source: () => ({ outcome: "ok", value: sourceCase.source }),
                  checks: loaded.value,
                  parse: options.parse,
                }).then((hits): Outcome<readonly CaseVerdict[]> => {
                  if (hits.outcome === "failed") {
                    return hits;
                  }
                  return {
                    outcome: "ok",
                    value: [
                      {
                        caseName: sourceCase.name,
                        flaggedLines: [...new Set(hits.value.map((hit) => hit.anchor.line))],
                      },
                    ],
                  };
                }),
            }),
    ),
});
