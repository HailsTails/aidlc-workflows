import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type {
  RunnerClause,
  RunRequest,
  StandaloneRunner,
} from "../../../core/mechanism-port/runner-module-schema.ts";
import type { CaseVerdict, Hit } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AnchorKind } from "../../../core/values/anchor.ts";
import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import {
  anchoredSnippetsSchema,
  type LoadedWalkerCheck,
  pathVerdictSchema,
  repositoryFindingsSchema,
  walkerPieceModuleSchema,
  walkerPieceSettingsSchema,
} from "./walker-check-schema.ts";
import type { AnchoredSnippet, ParsePort } from "./walker-check.ts";
import { cachedParsePort, createRepositoryContext } from "./repository-context.ts";
import type { WalkerRepository } from "./walker-check.ts";

type SelectedCheck = {
  readonly address: ClauseAddress;
  readonly anchorKind: AnchorKind;
  readonly pieceRoot: string;
  readonly order: number;
  readonly check: LoadedWalkerCheck;
  readonly settings: unknown;
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

const selectedModule = (request: {
  readonly clause: RunnerClause;
  readonly order: number;
  readonly path: PathPort;
}): Outcome<readonly SelectedModule[]> => {
  const settings = walkerPieceSettingsSchema.safeParse(request.clause.settings);
  if (!settings.success) {
    return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: settings.error.message });
  }
  return {
    outcome: "ok",
    value: [
      {
        clause: request.clause,
        order: request.order,
        modulePath: request.path.join({ segments: [request.clause.pieceRoot, settings.data.module] }),
      },
    ],
  };
};

const selectModules = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
}): Outcome<readonly SelectedModule[]> =>
  collectOutcomes({
    outcomes: request.clauses.map((clause, order) => selectedModule({ clause, order, path: request.path })),
  });

const acceptedModule = (request: {
  readonly loaded: ModuleLoad;
  readonly pieceRoot: string;
}): Outcome<LoadedWalkerCheck> => {
  if (request.loaded.outcome === "failed") {
    return pieceInvalid({ pieceRoot: request.pieceRoot, detail: request.loaded.error.detail });
  }
  const parsed = walkerPieceModuleSchema.safeParse(request.loaded.value);
  if (!parsed.success) {
    return pieceInvalid({ pieceRoot: request.pieceRoot, detail: parsed.error.message });
  }
  return { outcome: "ok", value: parsed.data.check };
};

const loadModule = (request: {
  readonly modulePath: string;
  readonly pieceRoot: string;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<LoadedWalkerCheck>> =>
  request.modules
    .load({ path: request.modulePath })
    .then((loaded) => acceptedModule({ loaded, pieceRoot: request.pieceRoot }));

const firstPerModule = (request: {
  readonly selected: readonly SelectedModule[];
}): readonly SelectedModule[] =>
  request.selected.filter(
    (entry, index) => request.selected.findIndex((other) => other.modulePath === entry.modulePath) === index,
  );

const checksSharingModule = (request: {
  readonly selected: readonly SelectedModule[];
  readonly modulePath: string;
  readonly loaded: Outcome<LoadedWalkerCheck>;
}): Outcome<readonly SelectedCheck[]> => {
  if (request.loaded.outcome === "failed") {
    return request.loaded;
  }
  const check = request.loaded.value;
  return {
    outcome: "ok",
    value: request.selected
      .filter((entry) => entry.modulePath === request.modulePath)
      .map((entry) => ({
        address: entry.clause.address,
        anchorKind: entry.clause.anchor,
        pieceRoot: entry.clause.pieceRoot,
        order: entry.order,
        check,
        settings: entry.clause.settings,
      })),
  };
};

const loadSelectedChecks = (request: {
  readonly selected: readonly SelectedModule[];
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<readonly SelectedCheck[]>> =>
  Promise.all(
    firstPerModule(request).map((first) =>
      loadModule({ modulePath: first.modulePath, pieceRoot: first.clause.pieceRoot, modules: request.modules }).then(
        (loaded) => checksSharingModule({ selected: request.selected, modulePath: first.modulePath, loaded }),
      ),
    ),
  ).then((outcomes) => collectOutcomes({ outcomes }));

const loadChecks = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
}): Promise<Outcome<readonly SelectedCheck[]>> => {
  const selected = selectModules({ clauses: request.clauses, path: request.path });
  if (selected.outcome === "failed") {
    return Promise.resolve(selected);
  }
  return loadSelectedChecks({ selected: selected.value, modules: request.modules });
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

const anchorAtOf = (request: {
  readonly source: string;
}): ((anchorRequest: { readonly position: number }) => AnchoredSnippet) => {
  const lineStarts = lineStartsOf(request);
  return (anchorRequest) => anchorWithin({ source: request.source, lineStarts, position: anchorRequest.position });
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

const acceptedPathVerdict = (request: {
  readonly returned: unknown;
  readonly selected: SelectedCheck;
  readonly file: RepoPath;
}): Outcome<readonly OrderedHit[]> => {
  const verdict = pathVerdictSchema.safeParse(request.returned);
  if (!verdict.success) {
    return pieceInvalid({ pieceRoot: request.selected.pieceRoot, detail: verdict.error.message });
  }
  if (verdict.data === "conforms") {
    return { outcome: "ok", value: [] };
  }
  return {
    outcome: "ok",
    value: [
      {
        hit: {
          clause: request.selected.address,
          file: request.file,
          anchor: { line: 1, column: 0 },
          snippet: request.file,
        },
        order: request.selected.order,
      },
    ],
  };
};

const inspectPath = (request: {
  readonly selected: SelectedCheck;
  readonly file: RepoPath;
}): Promise<Outcome<readonly OrderedHit[]>> =>
  settleCheck({
    pieceRoot: request.selected.pieceRoot,
    call: () => request.selected.check.inspect({ file: request.file }),
    accept: (returned) => acceptedPathVerdict({ ...request, returned }),
  });

const pathHits = (request: {
  readonly file: RepoPath;
  readonly checks: readonly SelectedCheck[];
}): Promise<Outcome<readonly OrderedHit[]>> =>
  Promise.all(request.checks.map((selected) => inspectPath({ selected, file: request.file }))).then((outcomes) =>
    collectOutcomes({ outcomes }),
  );

type ParsedFile<Tree, Node> = {
  readonly tree: Tree;
  readonly nodes: readonly Node[];
};

const everyNodeOf = <Api, Tree, Node>(request: {
  readonly parse: ParsePort<Api, Tree, Node>;
  readonly node: Tree | Node;
}): readonly Node[] =>
  request.parse
    .children({ node: request.node })
    .flatMap((child) => [child, ...everyNodeOf({ parse: request.parse, node: child })]);

const treeAndNodes = <Api, Tree, Node>(request: {
  readonly parse: ParsePort<Api, Tree, Node>;
  readonly file: RepoPath;
  readonly source: string;
}): ParsedFile<Tree, Node> => {
  const tree = request.parse.parse({ fileName: request.file, source: request.source });
  return { tree, nodes: everyNodeOf({ parse: request.parse, node: tree }) };
};

const parsedFile = <Api, Tree, Node>(request: {
  readonly parse: ParsePort<Api, Tree, Node>;
  readonly file: RepoPath;
  readonly source: string;
}): Promise<Outcome<ParsedFile<Tree, Node>>> =>
  Promise.resolve()
    .then(() => treeAndNodes(request))
    .then(
      (parsed): Outcome<ParsedFile<Tree, Node>> => ({ outcome: "ok", value: parsed }),
      (thrown: unknown): Outcome<ParsedFile<Tree, Node>> => ({
        outcome: "failed",
        error: { kind: "file-unparseable", file: request.file, detail: thrownDetail({ thrown }) },
      }),
    );

const acceptedSnippets = (request: {
  readonly returned: unknown;
  readonly selected: SelectedCheck;
  readonly file: RepoPath;
}): Outcome<readonly OrderedHit[]> => {
  const found = anchoredSnippetsSchema.safeParse(request.returned);
  if (!found.success) {
    return pieceInvalid({ pieceRoot: request.selected.pieceRoot, detail: found.error.message });
  }
  return {
    outcome: "ok",
    value: found.data.map((anchored) => ({
      hit: {
        clause: request.selected.address,
        file: request.file,
        anchor: anchored.anchor,
        snippet: anchored.snippet,
      },
      order: request.selected.order,
    })),
  };
};

const inspectNode = <Api, Tree, Node>(request: {
  readonly selected: SelectedCheck;
  readonly node: Node;
  readonly tree: Tree;
  readonly syntaxApi: Api;
  readonly anchorAt: (anchorRequest: { readonly position: number }) => AnchoredSnippet;
  readonly file: RepoPath;
}): Promise<Outcome<readonly OrderedHit[]>> => {
  const inspectRequest = {
    node: request.node,
    tree: request.tree,
    syntaxApi: request.syntaxApi,
    anchorKind: request.selected.anchorKind,
    anchorAt: request.anchorAt,
  };
  return settleCheck({
    pieceRoot: request.selected.pieceRoot,
    call: () => request.selected.check.inspect(inspectRequest),
    accept: (returned) => acceptedSnippets({ returned, selected: request.selected, file: request.file }),
  });
};

const inspectedNodes = <Api, Tree, Node>(request: {
  readonly file: RepoPath;
  readonly source: string;
  readonly checks: readonly SelectedCheck[];
  readonly syntaxApi: Api;
  readonly parsed: ParsedFile<Tree, Node>;
}): Promise<Outcome<readonly OrderedHit[]>> => {
  const anchorAt = anchorAtOf({ source: request.source });
  return Promise.all(
    request.checks.flatMap((selected) =>
      request.parsed.nodes.map((node) =>
        inspectNode({
          selected,
          node,
          tree: request.parsed.tree,
          syntaxApi: request.syntaxApi,
          anchorAt,
          file: request.file,
        }),
      ),
    ),
  ).then((outcomes) => collectOutcomes({ outcomes }));
};

const hitsOfParsed = <Api, Tree, Node>(request: {
  readonly file: RepoPath;
  readonly source: string;
  readonly checks: readonly SelectedCheck[];
  readonly syntaxApi: Api;
  readonly parsed: Outcome<ParsedFile<Tree, Node>>;
}): Promise<Outcome<readonly OrderedHit[]>> => {
  if (request.parsed.outcome === "failed") {
    return Promise.resolve(request.parsed);
  }
  return inspectedNodes({ ...request, parsed: request.parsed.value });
};

const syntaxWork = (request: {
  readonly file: RepoPath;
  readonly checks: readonly SelectedCheck[];
}): "none" | "some" =>
  request.checks.length === 0 || DECLARATION_FILE_ENDINGS.some((ending) => request.file.endsWith(ending))
    ? "none"
    : "some";

const syntaxHits = <Api, Tree, Node>(request: {
  readonly file: RepoPath;
  readonly source: SourceRequest;
  readonly checks: readonly SelectedCheck[];
  readonly parse: ParsePort<Api, Tree, Node>;
}): Promise<Outcome<readonly OrderedHit[]>> => {
  if (syntaxWork(request) === "none") {
    return Promise.resolve({ outcome: "ok", value: [] });
  }
  const source = request.source();
  if (source.outcome === "failed") {
    return Promise.resolve(source);
  }
  return parsedFile({ parse: request.parse, file: request.file, source: source.value }).then((parsed) =>
    hitsOfParsed({ ...request, source: source.value, syntaxApi: request.parse.syntaxApi, parsed }),
  );
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

const orderedFileHits = (request: {
  readonly fromPaths: Outcome<readonly OrderedHit[]>;
  readonly fromSyntax: Outcome<readonly OrderedHit[]>;
}): Outcome<readonly Hit[]> => {
  const gathered = collectOutcomes({ outcomes: [request.fromPaths, request.fromSyntax] });
  if (gathered.outcome === "failed") {
    return gathered;
  }
  return { outcome: "ok", value: inSourceOrder({ hits: gathered.value }) };
};

const hitsAfterPaths = <Api, Tree, Node>(request: {
  readonly file: RepoPath;
  readonly source: SourceRequest;
  readonly checks: readonly SelectedCheck[];
  readonly parse: ParsePort<Api, Tree, Node>;
  readonly fromPaths: Outcome<readonly OrderedHit[]>;
}): Promise<Outcome<readonly Hit[]>> => {
  if (request.fromPaths.outcome === "failed") {
    return Promise.resolve(request.fromPaths);
  }
  const fromPaths = request.fromPaths;
  return syntaxHits({
    file: request.file,
    source: request.source,
    checks: request.checks.filter((selected) => selected.check.kind === "syntax"),
    parse: request.parse,
  }).then((fromSyntax) => orderedFileHits({ fromPaths, fromSyntax }));
};

const hitsForFile = <Api, Tree, Node>(request: {
  readonly file: RepoPath;
  readonly source: SourceRequest;
  readonly checks: readonly SelectedCheck[];
  readonly parse: ParsePort<Api, Tree, Node>;
}): Promise<Outcome<readonly Hit[]>> =>
  pathHits({
    file: request.file,
    checks: request.checks.filter((selected) => selected.check.kind === "path"),
  }).then((fromPaths) => hitsAfterPaths({ ...request, fromPaths }));

const appendedStep = <Walked, Value>(request: {
  readonly gathered: Outcome<readonly Value[]>;
  readonly walked: Walked;
  readonly step: (walked: Walked) => Promise<Outcome<readonly Value[]>>;
}): Promise<Outcome<readonly Value[]>> => {
  if (request.gathered.outcome === "failed") {
    return Promise.resolve(request.gathered);
  }
  return request
    .step(request.walked)
    .then((next) => collectOutcomes({ outcomes: [request.gathered, next] }));
};

const inSequence = <Walked, Value>(request: {
  readonly sequence: readonly Walked[];
  readonly step: (walked: Walked) => Promise<Outcome<readonly Value[]>>;
}): Promise<Outcome<readonly Value[]>> =>
  request.sequence.reduce<Promise<Outcome<readonly Value[]>>>(
    (pending, walked) => pending.then((gathered) => appendedStep({ gathered, walked, step: request.step })),
    Promise.resolve({ outcome: "ok", value: [] }),
  );

const repoSource = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: string;
  readonly file: RepoPath;
}): SourceRequest => () => {
  const text = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, request.file] }) });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-unreadable", file: request.file, detail: text.error.detail } };
  }
  return text;
};

const caseVerdict = (request: {
  readonly caseName: string;
  readonly hits: Outcome<readonly Hit[]>;
}): Outcome<readonly CaseVerdict[]> => {
  if (request.hits.outcome === "failed") {
    return request.hits;
  }
  return {
    outcome: "ok",
    value: [
      {
        caseName: request.caseName,
        flaggedLines: [...new Set(request.hits.value.map((hit) => hit.anchor.line))],
      },
    ],
  };
};

const repoFileHits = <Api, Tree, Node>(request: {
  readonly options: WalkerPorts<Api, Tree, Node>;
  readonly checks: readonly SelectedCheck[];
  readonly repoRoot: string;
  readonly file: RepoPath;
}): Promise<Outcome<readonly Hit[]>> =>
  hitsForFile({
    file: request.file,
    source: repoSource({ ...request.options, repoRoot: request.repoRoot, file: request.file }),
    checks: request.checks,
    parse: request.options.parse,
  });

const runOverFiles = <Api, Tree, Node>(request: {
  readonly options: WalkerPorts<Api, Tree, Node>;
  readonly run: RunRequest;
  readonly loaded: Outcome<readonly SelectedCheck[]>;
}): Promise<Outcome<readonly Hit[]>> => {
  if (request.loaded.outcome === "failed") {
    return Promise.resolve(request.loaded);
  }
  const checks = request.loaded.value;
  const parse = cachedParsePort(request.options.parse);
  const repository = createRepositoryContext({ ...request.options, parse, ...request.run });
  return inSequence({
    sequence: request.run.files,
    step: (file) => repoFileHits({ options: { ...request.options, parse }, checks, repoRoot: request.run.repoRoot, file }),
  }).then(async (fileHits) => {
    if (fileHits.outcome === "failed") {
      return fileHits;
    }
    const contextHits = await repositoryHits({ checks, repository });
    return collectOutcomes({ outcomes: [fileHits, contextHits] });
  });
};

const repositoryHits = <Api, Tree, Node>(request: {
  readonly checks: readonly SelectedCheck[];
  readonly repository: WalkerRepository<Api, Tree, Node>;
}): Promise<Outcome<readonly Hit[]>> => inSequence({
  sequence: request.checks.filter((selected) => selected.check.kind === "repository"),
  step: (selected) => settleCheck({
    pieceRoot: selected.pieceRoot,
    call: () => selected.check.inspect({ repository: request.repository, settings: selected.settings }),
    accept: (returned) => {
      const parsed = repositoryFindingsSchema.safeParse(returned);
      if (!parsed.success) {
        return pieceInvalid({ pieceRoot: selected.pieceRoot, detail: parsed.error.message });
      }
      return parsed.data.outcome === "failed" ? parsed.data : {
        outcome: "ok", value: parsed.data.value.map((finding) => ({ ...finding, clause: selected.address })),
      };
    },
  }),
});

const conformCase = <Api, Tree, Node>(request: {
  readonly options: WalkerPorts<Api, Tree, Node>;
  readonly checks: readonly SelectedCheck[];
  readonly sourceCase: SourceCase;
}): Promise<Outcome<readonly CaseVerdict[]>> =>
  hitsForFile({
    file: request.sourceCase.fileName,
    source: () => ({ outcome: "ok", value: request.sourceCase.source }),
    checks: request.checks,
    parse: request.options.parse,
  }).then(async (hits) => {
    if (hits.outcome === "failed") {
      return hits;
    }
    const file = request.sourceCase.fileName;
    const repository = createRepositoryContext({
      ...request.options,
      repoRoot: "",
      files: [file], trackedPaths: [file],
      fileText: {
        read: () => ({ outcome: "ok", value: request.sourceCase.source }),
        exists: ({ path }) => path === file ? "present" : "absent",
      },
    });
    const contextHits = await repositoryHits({ checks: request.checks, repository });
    return caseVerdict({ caseName: request.sourceCase.name, hits: collectOutcomes({ outcomes: [hits, contextHits] }) });
  });

const conformCases = <Api, Tree, Node>(request: {
  readonly options: WalkerPorts<Api, Tree, Node>;
  readonly cases: readonly SourceCase[];
  readonly loaded: Outcome<readonly SelectedCheck[]>;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  if (request.loaded.outcome === "failed") {
    return Promise.resolve(request.loaded);
  }
  const checks = request.loaded.value;
  return inSequence({
    sequence: request.cases,
    step: (sourceCase) => conformCase({ options: request.options, checks, sourceCase }),
  });
};

export const createWalkerRunner = <Api, Tree, Node>(
  options: WalkerPorts<Api, Tree, Node>,
): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: (request) =>
    loadChecks({ clauses: request.clauses, modules: options.modules, path: options.path }).then((loaded) =>
      runOverFiles({ options, run: request, loaded }),
    ),
  conform: (request) =>
    loadChecks({ clauses: [request.clause], modules: options.modules, path: options.path }).then((loaded) =>
      conformCases({ options, cases: request.cases, loaded }),
    ),
});
