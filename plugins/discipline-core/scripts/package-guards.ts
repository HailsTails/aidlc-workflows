import { z } from "zod";
import type { Result } from "../core/values/result.ts";
import { createDefaultJsoncParsePort } from "../mechanisms/audit/runner/jsonc-parse.ts";
import type { BundledOutput } from "./esbuild-bundler-port.ts";
import { builtModulePath } from "./package-plan.ts";

export type BundledPackageVersion = { readonly root: string; readonly name: string; readonly version: string };

export type ShippedText = { readonly path: string; readonly text: string };

const BUILTIN_PREFIX = "node:";

const PAGE_SUFFIX = ".md";

const RELATIVE_LINK = /\]\(([^)\s]+)\)/g;

const PACKAGE_PATH = "/package/";

const PACKAGE_BASE = `file://${PACKAGE_PATH}`;

const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|#)/i;

const NODE_MODULES_SEGMENT = /(?:^|\/)node_modules\//g;

const PACKAGE_PATH_SEPARATOR = "/";

const PACKAGE_NAME_IN_KEY = /@[^/]+\/[^/]+|[^/]+/g;

const dependenciesSchema = z.record(z.string(), z.string());

const lockedPackageSchema = z
  .tuple([z.string(), z.string(), z.object({ dependencies: dependenciesSchema.optional(), optionalDependencies: dependenciesSchema.optional() })])
  .rest(z.unknown());

const lockSchema = z.object({ packages: z.record(z.string(), lockedPackageSchema) });

type LockedPackages = z.output<typeof lockSchema>["packages"];

const jsonc = createDefaultJsoncParsePort({ trailingCommas: "allowed" });

const lockKeyOf = (request: { readonly root: string }): string =>
  request.root.replace(NODE_MODULES_SEGMENT, (segment) => (segment.startsWith("/") ? "/" : ""));

const versionOfResolution = (request: { readonly resolution: string }): string =>
  request.resolution.slice(request.resolution.lastIndexOf("@") + 1);

const packagePathOf = (request: { readonly key: string }): readonly string[] => request.key.match(PACKAGE_NAME_IN_KEY) ?? [];

const resolvedKeyOf = (request: {
  readonly dependent: readonly string[];
  readonly name: string;
  readonly locked: LockedPackages;
}): string | undefined =>
  request.dependent
    .map((_, index) => [...request.dependent.slice(0, request.dependent.length - index), request.name].join(PACKAGE_PATH_SEPARATOR))
    .concat(request.name)
    .find((key) => Object.hasOwn(request.locked, key));

const dependencyKeysOf = (request: { readonly key: string; readonly locked: LockedPackages }): readonly string[] => {
  const dependencySections = request.locked[request.key]?.[2];
  const dependent = packagePathOf({ key: request.key });
  return Object.keys({ ...dependencySections?.dependencies, ...dependencySections?.optionalDependencies }).flatMap((name) => {
    const resolved = resolvedKeyOf({ dependent, name, locked: request.locked });
    return resolved === undefined ? [] : [resolved];
  });
};

const closureOf = (request: {
  readonly pending: readonly string[];
  readonly reached: ReadonlySet<string>;
  readonly locked: LockedPackages;
}): ReadonlySet<string> => {
  const [key, ...rest] = request.pending;
  if (key === undefined) {
    return request.reached;
  }
  return request.reached.has(key)
    ? closureOf({ ...request, pending: rest })
    : closureOf({
        pending: [...rest, ...dependencyKeysOf({ key, locked: request.locked })],
        reached: new Set([...request.reached, key]),
        locked: request.locked,
      });
};

type ExternalImport = "builtin" | "peer" | "unbundled";

const externalImportOf = (request: { readonly specifier: string; readonly peers: readonly string[] }): ExternalImport => {
  if (request.specifier.startsWith(BUILTIN_PREFIX)) {
    return "builtin";
  }
  return request.peers.some((peer) => request.specifier === peer || request.specifier.startsWith(`${peer}/`)) ? "peer" : "unbundled";
};

export const unbundledImportsOf = (request: {
  readonly outputs: readonly BundledOutput[];
  readonly peers: readonly string[];
}): readonly string[] =>
  request.outputs.flatMap((output) =>
    output.externalImports
      .filter((specifier) => externalImportOf({ specifier, peers: request.peers }) === "unbundled")
      .map((specifier) => `${output.path} imports ${specifier}`),
  );

type EntryPlacement = "in-place" | "misplaced";

const entryPlacementOf = (request: { readonly entryPoint: string; readonly outputs: readonly BundledOutput[] }): EntryPlacement =>
  request.outputs.some(
    (output) =>
      output.path === builtModulePath({ path: request.entryPoint }) &&
      output.entryPoint === request.entryPoint &&
      output.inputs.includes(request.entryPoint),
  )
    ? "in-place"
    : "misplaced";

export const misplacedEntriesOf = (request: {
  readonly entryPoints: readonly string[];
  readonly outputs: readonly BundledOutput[];
}): readonly string[] =>
  request.entryPoints
    .filter((entryPoint) => entryPlacementOf({ entryPoint, outputs: request.outputs }) === "misplaced")
    .map((entryPoint) => `${entryPoint} is not emitted with its own code at ${builtModulePath({ path: entryPoint })}`);

const lockProblemOf = (request: {
  readonly bundled: BundledPackageVersion;
  readonly locked: LockedPackages;
  readonly closure: ReadonlySet<string>;
}): readonly string[] => {
  const label = `${request.bundled.name} ${request.bundled.version} at ${request.bundled.root}`;
  const key = lockKeyOf({ root: request.bundled.root });
  const resolution = request.locked[key]?.[0];
  const locked = resolution === undefined ? undefined : versionOfResolution({ resolution });
  if (locked === undefined) {
    return [`${label}, which the lock does not hold`];
  }
  if (locked !== request.bundled.version) {
    return [`${label}, but the lock holds ${locked}`];
  }
  return request.closure.has(key) ? [] : [`${label}, which is not in the closure of core's dependencies in the lock`];
};

export const unlockedPackagesOf = (request: {
  readonly bundled: readonly BundledPackageVersion[];
  readonly lockText: string;
  readonly dependencies: readonly string[];
}): Result<readonly string[], string> => {
  const document = jsonc.parse({ source: request.lockText });
  if (document.outcome === "failed") {
    return { outcome: "failed", error: document.error.detail };
  }
  const lock = lockSchema.safeParse(document.value);
  if (!lock.success) {
    return { outcome: "failed", error: z.prettifyError(lock.error) };
  }
  const locked = lock.data.packages;
  const unheld = request.dependencies.find((name) => !Object.hasOwn(locked, name));
  if (unheld !== undefined) {
    return { outcome: "failed", error: `core depends on ${unheld}, which the lock does not hold` };
  }
  const closure = closureOf({ pending: request.dependencies, reached: new Set(), locked });
  return { outcome: "ok", value: request.bundled.flatMap((bundled) => lockProblemOf({ bundled, locked, closure })) };
};

const resolvedLink = (request: { readonly page: string; readonly link: string }): string => {
  const pathname = decodeURIComponent(new URL(request.link.split("#")[0], `${PACKAGE_BASE}${request.page}`).pathname);
  const inside = pathname.startsWith(PACKAGE_PATH) ? pathname.slice(PACKAGE_PATH.length) : pathname;
  return inside.endsWith("/") ? inside.slice(0, -1) : inside;
};

type LinkTarget = "shipped" | "dead";

const linkTargetOf = (request: { readonly target: string; readonly paths: readonly string[] }): LinkTarget =>
  request.paths.some((path) => path === request.target || path.startsWith(`${request.target}/`)) ? "shipped" : "dead";

export const deadLinksOf = (request: { readonly files: readonly ShippedText[] }): readonly string[] => {
  const paths = request.files.map((file) => file.path);
  return request.files
    .filter((file) => file.path.endsWith(PAGE_SUFFIX))
    .flatMap((file) =>
      [...file.text.matchAll(RELATIVE_LINK)]
        .map((match) => match[1])
        .filter((link) => !NOT_RELATIVE.test(link))
        .map((link) => resolvedLink({ page: file.path, link }))
        .filter((target) => linkTargetOf({ target, paths }) === "dead")
        .map((target) => `${file.path} links to ${target}`),
    );
};
