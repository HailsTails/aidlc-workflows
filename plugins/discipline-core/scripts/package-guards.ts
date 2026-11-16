import { z } from "zod";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";
import type { BundledOutput } from "./esbuild-bundler-port.ts";
import { builtModulePath } from "./package-plan.ts";

export type BundledPackageVersion = { readonly root: string; readonly name: string; readonly version: string };

export type ShippedText = { readonly path: string; readonly text: string };

const BUILTIN_PREFIX = "node:";

const PAGE_SUFFIX = ".md";

const RELATIVE_LINK = /\]\(([^)\s]+)\)/g;

const PACKAGE_PATH = "/package/";

const PACKAGE_BASE = `file://${PACKAGE_PATH}`;

const NOT_RELATIVE =/^(?:[a-z][a-z0-9+.-]*:|#)/i;

const lockSchema = z.object({
  packages: z.record(z.string(), z.looseObject({ version: z.string().optional() })),
});

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
  readonly locked: Readonly<Record<string, { readonly version?: string | undefined }>>;
}): readonly string[] => {
  const label = `${request.bundled.name} ${request.bundled.version} at ${request.bundled.root}`;
  const locked = request.locked[request.bundled.root]?.version;
  if (locked === undefined) {
    return [`${label}, which the lock does not hold`];
  }
  return locked === request.bundled.version ? [] : [`${label}, but the lock holds ${locked}`];
};

export const unlockedPackagesOf = (request: {
  readonly bundled: readonly BundledPackageVersion[];
  readonly lockText: string;
}): Result<readonly string[], string> => {
  const document = parsedJson({ text: request.lockText });
  if (document.outcome === "failed") {
    return document;
  }
  const lock = lockSchema.safeParse(document.value);
  return lock.success
    ? { outcome: "ok", value: request.bundled.flatMap((bundled) => lockProblemOf({ bundled, locked: lock.data.packages })) }
    : { outcome: "failed", error: z.prettifyError(lock.error) };
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
