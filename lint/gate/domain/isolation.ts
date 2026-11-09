import type { Finding } from "./outcome.ts";

export type SourceReferences = {
  readonly imports: readonly string[];
  readonly globals: readonly string[];
};

export type SourceGraph = ReadonlyMap<string, SourceReferences>;

export type ImplementerFiles = {
  readonly file: string;
  readonly hermeticTest: string;
};

type Measure = {
  readonly graph: SourceGraph;
  readonly implementers: readonly ImplementerFiles[];
};

const IO_MODULES = new Set([
  "child_process",
  "dgram",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "net",
  "os",
  "process",
  "readline",
  "tty",
  "worker_threads",
]);

const NODE_PROTOCOL = "node:";

const TS_SUFFIX = ".ts";

const GLOBAL_NAMES = new Set(["Bun", "process", "require", "fetch", "import()"]);

export const isIoModule = (specifier: string): boolean =>
  specifier.startsWith(NODE_PROTOCOL) && IO_MODULES.has(specifier.slice(NODE_PROTOCOL.length));

const directory = (path: string): string => path.slice(0, path.lastIndexOf("/"));

const joinRelative = (from: string, specifier: string): string => {
  const parts = directory(from).split("/");
  for (const part of specifier.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== ".") {
      parts.push(part);
    }
  }
  return parts.join("/");
};

const resolved = (graph: SourceGraph, from: string, specifier: string): string | undefined => {
  const target = specifier.startsWith(".") ? joinRelative(from, specifier) : undefined;
  return target !== undefined && graph.has(target) ? target : undefined;
};

export const reachableFrom = (graph: SourceGraph, start: string): readonly string[] => {
  const seen = new Set<string>([start]);
  const queue = [start];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const specifier of graph.get(next)?.imports ?? []) {
      const target = resolved(graph, next, specifier);
      if (target !== undefined && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return [...seen];
};

const importsIo = (graph: SourceGraph, file: string): boolean =>
  (graph.get(file)?.imports ?? []).some(isIoModule);

export const platformReachOf = (
  request: Measure & { readonly test: string },
): string | undefined => {
  const implementerFiles = new Set(request.implementers.map(({ file }) => file));
  return reachableFrom(request.graph, request.test).find(
    (file) => implementerFiles.has(file) || importsIo(request.graph, file),
  );
};

const seamTestOf = (file: string): string => `${file.slice(0, -TS_SUFFIX.length)}.test.ts`;

const isExemptTest = (test: string, implementers: readonly ImplementerFiles[]): boolean =>
  implementers.some(({ file, hermeticTest }) => test === hermeticTest || test === seamTestOf(file));

const testOffenders = (measure: Measure, test: string): readonly string[] => {
  const reached = isExemptTest(test, measure.implementers)
    ? undefined
    : platformReachOf({ ...measure, test });
  return reached === undefined ? [] : [`${test} · test reaches ${reached}`];
};

const globalOffenders = (file: string, references: SourceReferences): readonly string[] =>
  references.globals
    .filter((name) => GLOBAL_NAMES.has(name))
    .map((name) => `${file} · uses ${name}`);

export const offendersOf = (measure: Measure): readonly string[] => {
  const implementerFiles = new Set(measure.implementers.map(({ file }) => file));
  return [...measure.graph.entries()].flatMap(([file, references]) => {
    if (file.endsWith(".test.ts")) {
      return testOffenders(measure, file);
    }
    return implementerFiles.has(file) ? [] : globalOffenders(file, references);
  });
};

const OFFENDER_FIX =
  "Unit tests reach the platform only through a fake of a kernel port; only the registered " +
  "implementer reaches Bun, process, require, fetch or a dynamic import. Inject the capability.";

type Records = {
  readonly recorded: readonly string[];
  readonly measured: readonly string[];
};

export const judgeIsolation = (request: Records): readonly Finding[] => {
  const known = new Set(request.recorded);
  return request.measured
    .filter((offender) => !known.has(offender))
    .map((offender) => ({
      subject: offender,
      violation: "is a new isolation offender",
      fix: OFFENDER_FIX,
    }));
};

export const narrowedOffenders = (request: Records): readonly string[] => {
  const present = new Set(request.measured);
  return request.recorded.filter((offender) => present.has(offender));
};
