import { runtimeImportKind } from "./runtime-import.ts";
import { basename, dirname, isAbsolute, join, posix, relative, sep } from "node:path";
import { existsSync, readFileSync, promises as sourceFileSystem } from "node:fs";
import { z } from "zod";
import type { BunPlugin } from "bun";
import ts from "typescript";

type RuntimeSource = { readonly file: string; readonly source: string };
type RuntimeArtifact = { readonly file: string; readonly content: string };
type RuntimeScan = {
  readonly imports: readonly string[];
  readonly exports: readonly string[];
  readonly hasUnsupportedImportMeta: boolean;
  readonly hasPackageImports: boolean;
};
type PluginRuntimePort = {
  readonly scan: (input: { readonly source: string }) => RuntimeScan;
  readonly declaration: (input: { readonly pluginRoot: string; readonly file: string }) => DeclarationBundle;
  readonly bundle: (input: {
    readonly pluginRoot: string;
    readonly file: string;
    readonly relativeImports: readonly string[];
  }) => Promise<string>;
};
type RuntimeCompilerPort = {
  readonly scan: (input: { readonly source: string }) => RuntimeScan | Promise<RuntimeScan>;
  readonly declaration: (input: PluginRuntimeSourceRequest) => DeclarationBundle | Promise<DeclarationBundle>;
  readonly bundle: PluginRuntimePort["bundle"];
};

type RuntimeCompilationFailure = {
  readonly kind: "runtime-scan-failed" | "runtime-declaration-failed" | "runtime-bundle-failed";
  readonly cause: unknown;
  readonly pluginRoot: string;
  readonly file: string;
  readonly message: string;
};

type RuntimeConfigurationFailure = {
  readonly kind: "compiler-configuration-failed";
  readonly projectRoot: string;
  readonly message: string;
};

type RuntimeArtifactFailure = {
  readonly kind: "artifact-directory-failed" | "artifact-write-failed" | "artifact-provider-failed";
  readonly outDir: string;
  readonly file: string;
  readonly message: string;
  readonly writtenFiles: readonly string[];
};

type UnavailablePluginRuntime = {
  readonly kind: "unavailable";
  readonly error: PluginRuntimeSourceFailure | RuntimeCompilationFailure | RuntimeConfigurationFailure | RuntimeArtifactFailure;
};

type UnavailableRuntimeCompilation = { readonly kind: "unavailable"; readonly error: RuntimeCompilationFailure };
type RuntimeCompilation<Compiled> = { readonly kind: "compiled"; readonly compiled: Compiled } | UnavailableRuntimeCompilation;

type RuntimeCompilerFactory = {
  readonly create: (input: { readonly projectRoot: string }) => Promise<RuntimeCompilerPort>;
};

type RuntimeCompilerAvailability = { readonly kind: "ready"; readonly port: RuntimeCompilerPort } | UnavailablePluginRuntime;

function runtimeFailureMessage(input: { readonly thrown: unknown }): string {
  try {
    return input.thrown instanceof Error ? input.thrown.message : String(input.thrown);
  } catch {
    return "Runtime operation failed without a printable message";
  }
}

export async function createPluginRuntimeCompiler(input: {
  readonly projectRoot: string;
  readonly factory?: RuntimeCompilerFactory;
}): Promise<RuntimeCompilerAvailability> {
  const factory = input.factory ?? {
    create: async ({ projectRoot }: { readonly projectRoot: string }) => createPluginRuntimePort({ projectRoot }),
  };
  try {
    return { kind: "ready", port: await factory.create({ projectRoot: input.projectRoot }) };
  } catch (thrown) {
    return { kind: "unavailable", error: {
      kind: "compiler-configuration-failed", projectRoot: input.projectRoot, message: runtimeFailureMessage({ thrown }),
    } };
  }
}

async function attemptRuntimeCompilation<Compiled>(input: {
  readonly request: PluginRuntimeSourceRequest;
  readonly kind: RuntimeCompilationFailure["kind"];
  readonly compile: () => Compiled | Promise<Compiled>;
}): Promise<RuntimeCompilation<Compiled>> {
  try {
    return { kind: "compiled", compiled: await input.compile() };
  } catch (thrown) {
    return { kind: "unavailable", error: {
      kind: input.kind, ...input.request, message: runtimeFailureMessage({ thrown }), cause: thrown,
    } };
  }
}

export function compilePluginRuntimeDeclaration(input: {
  readonly pluginRoot: string;
  readonly file: string;
  readonly port: Pick<RuntimeCompilerPort, "declaration">;
}): Promise<RuntimeCompilation<DeclarationBundle>> {
  return attemptRuntimeCompilation({
    request: { pluginRoot: input.pluginRoot, file: input.file },
    kind: "runtime-declaration-failed",
    compile: () => input.port.declaration({ pluginRoot: input.pluginRoot, file: input.file }),
  });
}

type PreparedRuntime =
  | { readonly kind: "prepared"; readonly artifacts: readonly RuntimeArtifact[] }
  | { readonly kind: "refused"; readonly message: string };

type PluginRuntimeSourceRequest = { readonly pluginRoot: string; readonly file: string };

type PluginRuntimeSourceFailure = {
  readonly kind: "source-inspection-failed" | "source-read-failed" | "source-provider-failed";
  readonly pluginRoot: string;
  readonly file: string;
  readonly code: string | null;
  readonly message: string;
};

type UnavailablePluginRuntimeSource = { readonly kind: "unavailable"; readonly error: PluginRuntimeSourceFailure };

type PluginRuntimeSourceRead =
  | { readonly kind: "found"; readonly source: string }
  | { readonly kind: "missing" }
  | UnavailablePluginRuntimeSource;

type PluginRuntimeSourcePort = {
  readonly read: (input: PluginRuntimeSourceRequest) => Promise<PluginRuntimeSourceRead>;
};

type PluginRuntimeSourceFileSystem = {
  readonly inspect: (input: { readonly path: string }) => Promise<void>;
  readonly readText: (input: { readonly path: string }) => Promise<string>;
};

type ProjectedPluginRuntime = PreparedRuntime | UnavailablePluginRuntime;

type InspectedPluginRuntimeSource =
  | { readonly kind: "present" }
  | { readonly kind: "missing" }
  | UnavailablePluginRuntimeSource;

type SelectedPluginRuntimeSources =
  | { readonly kind: "selected"; readonly sources: readonly RuntimeSource[] }
  | UnavailablePluginRuntimeSource;

const sourceFailureSchema = z.object({ code: z.string().optional(), message: z.string().optional() });

function unavailableRuntimeSource(input: {
  readonly request: PluginRuntimeSourceRequest;
  readonly kind: PluginRuntimeSourceFailure["kind"];
  readonly thrown: unknown;
}): UnavailablePluginRuntimeSource {
  const unavailable: UnavailablePluginRuntimeSource = { kind: "unavailable", error: {
    kind: input.kind, ...input.request, code: null, message: runtimeFailureMessage(input),
  } };
  try {
    const parsed = sourceFailureSchema.safeParse(input.thrown);
    if (!parsed.success) return unavailable;
    return { kind: "unavailable", error: {
      ...unavailable.error, code: parsed.data.code ?? null, message: parsed.data.message ?? unavailable.error.message,
    } };
  } catch {
    return unavailable;
  }
}

async function inspectPluginRuntimeSource(input: {
  readonly request: PluginRuntimeSourceRequest;
  readonly fileSystem: PluginRuntimeSourceFileSystem;
}): Promise<InspectedPluginRuntimeSource> {
  try {
    await input.fileSystem.inspect({ path: join(input.request.pluginRoot, input.request.file) });
    return { kind: "present" };
  } catch (thrown) {
    const unavailable = unavailableRuntimeSource({ request: input.request, kind: "source-inspection-failed", thrown });
    if (unavailable.error.code === "ENOENT" || unavailable.error.code === "ENOTDIR") return { kind: "missing" };
    return unavailable;
  }
}

async function readInspectedPluginRuntimeSource(input: {
  readonly request: PluginRuntimeSourceRequest;
  readonly inspected: InspectedPluginRuntimeSource;
  readonly fileSystem: PluginRuntimeSourceFileSystem;
}): Promise<PluginRuntimeSourceRead> {
  if (input.inspected.kind !== "present") return input.inspected;
  try {
    return { kind: "found", source: await input.fileSystem.readText({
      path: join(input.request.pluginRoot, input.request.file),
    }) };
  } catch (thrown) {
    return unavailableRuntimeSource({ request: input.request, kind: "source-read-failed", thrown });
  }
}

export function createPluginRuntimeSourcePort(input: {
  readonly fileSystem?: PluginRuntimeSourceFileSystem;
} = {}): PluginRuntimeSourcePort {
  const fileSystem = input.fileSystem ?? {
    inspect: async ({ path }: { readonly path: string }) => { await sourceFileSystem.stat(path); },
    readText: ({ path }: { readonly path: string }) => sourceFileSystem.readFile(path, "utf-8"),
  };
  return {
    read: async (request) => readInspectedPluginRuntimeSource({
      request, fileSystem, inspected: await inspectPluginRuntimeSource({ request, fileSystem }),
    }),
  };
}

async function readProjectedPluginRuntimeSource(input: {
  readonly request: PluginRuntimeSourceRequest;
  readonly sourcePort: PluginRuntimeSourcePort;
}): Promise<PluginRuntimeSourceRead> {
  try {
    return await input.sourcePort.read(input.request);
  } catch (thrown) {
    return unavailableRuntimeSource({ request: input.request, kind: "source-provider-failed", thrown });
  }
}

async function collectProjectedRuntimeSource(input: {
  readonly selected: SelectedPluginRuntimeSources;
  readonly request: PluginRuntimeSourceRequest;
  readonly sourcePort: PluginRuntimeSourcePort;
}): Promise<SelectedPluginRuntimeSources> {
  if (input.selected.kind === "unavailable") return input.selected;
  const loaded = await readProjectedPluginRuntimeSource(input);
  switch (loaded.kind) {
    case "unavailable": return loaded;
    case "missing": return input.selected;
    case "found": return { kind: "selected", sources: [
      ...input.selected.sources, { file: input.request.file, source: loaded.source },
    ] };
  }
}

function projectedRuntimeSources(input: {
  readonly pluginRoot: string;
  readonly files: readonly string[];
  readonly sourcePort: PluginRuntimeSourcePort;
}): Promise<SelectedPluginRuntimeSources> {
  return input.files.filter((file) => /\.[cm]?[jt]s$/.test(file) && !/\.d\.[cm]?ts$/.test(file))
    .reduce<Promise<SelectedPluginRuntimeSources>>(async (previous, file) => collectProjectedRuntimeSource({
      selected: await previous,
      request: { pluginRoot: input.pluginRoot, file },
      sourcePort: input.sourcePort,
    }), Promise.resolve({ kind: "selected", sources: [] }));
}

function closedPluginHookModules(input: { readonly sources: readonly RuntimeSource[] }): readonly string[] {
  return input.sources.filter(({ file }) => file.startsWith("hooks/") && file.endsWith(".ts"))
    .map(({ file }) => file);
}

async function prepareSelectedPluginRuntime(input: {
  readonly pluginRoot: string;
  readonly files: readonly string[];
  readonly selected: SelectedPluginRuntimeSources;
  readonly runtimePort: RuntimeCompilerPort;
  readonly closedModules?: readonly string[];
}): Promise<ProjectedPluginRuntime> {
  if (input.selected.kind === "unavailable") return input.selected;
  const sources = input.selected.sources;
  const missing = input.closedModules?.find((file) => !sources.some((source) => source.file === file));
  if (missing !== undefined) return { kind: "refused", message: `declared plugin command source is missing: ${missing}` };
  return prepareRuntimeArtifacts({
    pluginRoot: input.pluginRoot,
    files: input.files,
    sources: input.selected.sources,
    closedModules: [...closedPluginHookModules({ sources: input.selected.sources }), ...(input.closedModules ?? [])],
    port: input.runtimePort,
  });
}

export async function prepareProjectedPluginRuntimeArtifacts(input: {
  readonly pluginRoot: string;
  readonly files: readonly string[];
  readonly sourcePort: PluginRuntimeSourcePort;
  readonly runtimePort: RuntimeCompilerPort;
  readonly closedModules?: readonly string[];
}): Promise<ProjectedPluginRuntime> {
  return prepareSelectedPluginRuntime({
    pluginRoot: input.pluginRoot,
    files: input.files,
    selected: await projectedRuntimeSources(input),
    runtimePort: input.runtimePort,
    ...(input.closedModules === undefined ? {} : { closedModules: input.closedModules }),
  });
}

type CompiledRuntimePreparation = PreparedRuntime | UnavailableRuntimeCompilation;

type RuntimePreparationInput = {
  readonly pluginRoot: string;
  readonly files: readonly string[];
  readonly sources: readonly RuntimeSource[];
  readonly port: RuntimeCompilerPort;
  readonly closedModules?: readonly string[];
};

type RuntimeEntryInput = RuntimePreparationInput & {
  readonly entry: RuntimeSource;
  readonly prepared: CompiledRuntimePreparation;
};

type ScannedRuntimeEntry = RuntimePreparationInput & {
  readonly entry: RuntimeSource;
  readonly scan: RuntimeScan;
  readonly prepared: Extract<PreparedRuntime, { readonly kind: "prepared" }>;
};

export async function preparePluginRuntimeArtifacts(input: {
  readonly pluginRoot: string;
  readonly files: readonly string[];
  readonly sources: readonly RuntimeSource[];
  readonly port: PluginRuntimePort;
  readonly closedModules?: readonly string[];
}): Promise<PreparedRuntime> {
  const prepared = await prepareRuntimeArtifacts(input);
  if (prepared.kind === "unavailable") return Promise.reject(prepared.error.cause);
  return prepared;
}

function prepareRuntimeArtifacts(input: RuntimePreparationInput): Promise<CompiledRuntimePreparation> {
  return input.sources.reduce<Promise<CompiledRuntimePreparation>>(async (previous, entry) =>
    prepareRuntimeEntry({ ...input, entry, prepared: await previous }),
  Promise.resolve({ kind: "prepared", artifacts: [] }));
}

async function prepareRuntimeEntry(input: RuntimeEntryInput): Promise<CompiledRuntimePreparation> {
  if (input.prepared.kind !== "prepared") return input.prepared;
  const scanned = await attemptRuntimeCompilation({
    request: { pluginRoot: input.pluginRoot, file: input.entry.file },
    kind: "runtime-scan-failed", compile: () => input.port.scan({ source: input.entry.source }),
  });
  if (scanned.kind === "unavailable") return scanned;
  const scan = scanned.compiled;
  if (input.closedModules?.includes(input.entry.file)) return prepareClosedModule({ ...input, scan, prepared: input.prepared });
  if (!scan.hasPackageImports) return input.prepared;
  if (scan.hasUnsupportedImportMeta) return {
    kind: "refused", message: `plugin runtime companion would change import.meta semantics: ${input.entry.file}`,
  };
  return prepareRuntimeCompanions({ ...input, scan, prepared: input.prepared });
}

async function prepareRuntimeCompanions(input: ScannedRuntimeEntry): Promise<CompiledRuntimePreparation> {
  const stem = input.entry.file.replace(/\.[cm]?[jt]s$/, "");
  const runtimeFile = `${stem}.runtime.js`;
  const declarationFile = `${stem}.runtime.d.ts`;
  const occupied = [...input.files, ...input.prepared.artifacts.map(({ file }) => file)];
  const collision = [runtimeFile, declarationFile].find((file) => occupied.includes(file));
  if (collision !== undefined) return {
    kind: "refused", message: `plugin runtime companion collides with projected file: ${collision}`,
  };
  const declared = await compilePluginRuntimeDeclaration({ pluginRoot: input.pluginRoot, file: input.entry.file, port: input.port });
  if (declared.kind === "unavailable") return declared;
  const declaration = declared.compiled;
  const declarationCollision = declaration.companions.find((artifact) =>
    input.files.includes(artifact.file) || input.prepared.artifacts.some((prior) =>
      prior.file === artifact.file && prior.content !== artifact.content));
  if (declarationCollision !== undefined) return {
    kind: "refused", message: `plugin declaration companion collides with projected file: ${declarationCollision.file}`,
  };
  const bundled = await attemptRuntimeCompilation({
    request: { pluginRoot: input.pluginRoot, file: input.entry.file }, kind: "runtime-bundle-failed",
    compile: () => input.port.bundle({ pluginRoot: input.pluginRoot, file: input.entry.file,
      relativeImports: input.scan.imports.filter((path) => path.startsWith(".")) }),
  });
  if (bundled.kind === "unavailable") return bundled;
  const leaf = runtimeFile.split("/").at(-1);
  const facade = `export * from "./${leaf}";\n` +
    (input.scan.exports.includes("default") ? `export { default } from "./${leaf}";\n` : "");
  return { kind: "prepared", artifacts: [...input.prepared.artifacts,
    { file: input.entry.file, content: facade },
    { file: runtimeFile, content: bundled.compiled },
    { file: declarationFile, content: declaration.content },
    ...declaration.companions.filter((artifact) => !input.prepared.artifacts.some((prior) => prior.file === artifact.file)),
  ] };
}

async function prepareClosedModule(input: ScannedRuntimeEntry): Promise<CompiledRuntimePreparation> {
  if (input.scan.hasUnsupportedImportMeta) return {
    kind: "refused", message: `plugin runtime closure would change import.meta semantics: ${input.entry.file}`,
  };
  const bundled = await attemptRuntimeCompilation({
    request: { pluginRoot: input.pluginRoot, file: input.entry.file }, kind: "runtime-bundle-failed",
    compile: () => input.port.bundle({ pluginRoot: input.pluginRoot, file: input.entry.file, relativeImports: [] }),
  });
  if (bundled.kind === "unavailable") return bundled;
  return { kind: "prepared", artifacts: [...input.prepared.artifacts, { file: input.entry.file, content: bundled.compiled }] };
}

type DeclarationBundle = {
  readonly content: string;
  readonly companions: readonly RuntimeArtifact[];
};

function declarationModules(input: { readonly source: string }): readonly string[] {
  const syntax = ts.createSourceFile("module.d.ts", input.source, ts.ScriptTarget.Latest, true);
  if (syntax.referencedFiles.length > 0 || syntax.typeReferenceDirectives.length > 0 ||
    syntax.libReferenceDirectives.length > 0 || syntax.hasNoDefaultLib)
    throw new Error("plugin declaration retains unsupported reference directives");
  const modules: string[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isModuleDeclaration(node) && (ts.isStringLiteral(node.name) ||
      (node.flags & ts.NodeFlags.GlobalAugmentation) !== 0))
      throw new Error("plugin declaration retains unsupported ambient module declarations");
    const module = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
      ? node.moduleSpecifier
      : ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
        ? node.moduleReference.expression
        : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
          ? node.argument.literal : undefined;
    if (module !== undefined && ts.isStringLiteral(module)) modules.push(module.text);
    ts.forEachChild(node, collect);
  };
  collect(syntax);
  return modules;
}

function ownedDeclarationBundle(input: {
  readonly content: string;
  readonly sourceFile: string;
  readonly pluginRoot: string;
  readonly file: string;
  readonly options: ts.CompilerOptions;
  readonly runtimeModules: readonly string[];
}): DeclarationBundle {
  const companions = new Map<string, RuntimeArtifact>();
  const copied = new Set<string>();
  const packageSchema = z.object({
    name: z.string().regex(/^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/),
    version: z.string().regex(/^[a-zA-Z0-9._+-]+$/),
  });
  const copyDeclaration = (sourceFile: string): string => {
    const marker = "/node_modules/";
    const at = sourceFile.lastIndexOf(marker);
    if (at < 0 || !/\.d\.[cm]?ts$/.test(sourceFile))
      throw new Error(`plugin declaration dependency is not a packaged declaration: ${sourceFile}`);
    const parts = sourceFile.slice(at + marker.length).split("/");
    const packageName = parts.slice(0, parts[0]?.startsWith("@") ? 2 : 1).join("/");
    const packageRoot = sourceFile.slice(0, at + marker.length) + packageName;
    const manifestFile = join(packageRoot, "package.json");
    const manifest = packageSchema.parse(JSON.parse(readFileSync(manifestFile, "utf-8")));
    const destinationRoot = posix.join("tools", `${basename(input.pluginRoot)}-runtime-types`,
      "node_modules", manifest.name);
    const destination = posix.join(destinationRoot, relative(packageRoot, sourceFile).split(sep).join("/"));
    if (copied.has(sourceFile)) return destination;
    copied.add(sourceFile);
    const content = readFileSync(sourceFile, "utf-8");
    companions.set(destination, { file: destination, content });
    companions.set(posix.join(destinationRoot, "package.json"), {
      file: posix.join(destinationRoot, "package.json"), content: readFileSync(manifestFile, "utf-8"),
    });
    const license = ["LICENSE", "LICENSE.md", "LICENSE.txt"].find((file) => existsSync(join(packageRoot, file)));
    if (license === undefined) throw new Error(`plugin declaration package has no license: ${manifest.name}`);
    companions.set(posix.join(destinationRoot, license), {
      file: posix.join(destinationRoot, license), content: readFileSync(join(packageRoot, license), "utf-8"),
    });
    for (const module of declarationModules({ source: content })) {
      if (runtimeImportKind({ specifier: module }) === "runtime-builtin") continue;
      if (!module.startsWith(".")) throw new Error(
        `plugin vendored declaration retains external package dependency "${module}": ${destination}`,
      );
      const resolved = ts.resolveModuleName(module, sourceFile, input.options, ts.sys).resolvedModule;
      if (resolved === undefined) throw new Error(`plugin declaration dependency is unresolved: ${destination}: ${module}`);
      const dependency = copyDeclaration(resolved.resolvedFileName);
      const expected = posix.normalize(posix.join(posix.dirname(destination),
        module.replace(/\.([cm]?)js$/, ".d.$1ts")));
      if (expected !== dependency) throw new Error(
        `plugin declaration dependency escapes its preserved package layout: ${destination}: ${module}`,
      );
    }
    return destination;
  };
  const replacements = new Map<string, string>();
  for (const module of [...new Set([...declarationModules({ source: input.content }), ...input.runtimeModules])]) {
    if (module.startsWith(".") || runtimeImportKind({ specifier: module }) === "runtime-builtin") continue;
    const resolved = ts.resolveModuleName(module, input.sourceFile, input.options, ts.sys).resolvedModule;
    if (resolved === undefined) throw new Error(`plugin declaration package is unresolved: ${input.file}: ${module}`);
    const destination = copyDeclaration(resolved.resolvedFileName);
    const path = posix.relative(posix.dirname(input.file), destination)
      .replace(/\.d\.([cm]?)ts$/, ".$1js");
    replacements.set(module, path.startsWith(".") ? path : `./${path}`);
  }
  const syntax = ts.createSourceFile("runtime.d.ts", input.content, ts.ScriptTarget.Latest, true);
  const rewritten = ts.transform(syntax, [(context) => (source) => {
    const visit = (node: ts.Node): ts.Node => {
      if (ts.isStringLiteral(node)) {
        const parent = node.parent;
        const moduleSpecifier = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
          parent.moduleSpecifier === node;
        const importType = ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent);
        const importEquals = ts.isExternalModuleReference(parent) && parent.expression === node;
        const replacement = replacements.get(node.text);
        if ((moduleSpecifier || importType || importEquals) && replacement !== undefined)
          return ts.factory.createStringLiteral(replacement);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitEachChild(source, visit, context);
  }]);
  const result = rewritten.transformed[0];
  if (result === undefined) throw new Error(`plugin declaration transformation failed: ${input.file}`);
  const content = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(result);
  rewritten.dispose();
  return { content, companions: [...companions.values()].sort((left, right) => left.file.localeCompare(right.file)) };
}

function entrySourceForCompanion(input: { readonly source: string; readonly file: string }): string {
  const syntax = ts.createSourceFile(input.file, input.source, ts.ScriptTarget.Latest, true);
  const authoredUrl = ts.factory.createPropertyAccessExpression(
    ts.factory.createNewExpression(ts.factory.createIdentifier("URL"), undefined, [
      ts.factory.createStringLiteral(`./${encodeURIComponent(basename(input.file))}`),
      ts.factory.createPropertyAccessExpression(
        ts.factory.createMetaProperty(ts.SyntaxKind.ImportKeyword, ts.factory.createIdentifier("meta")), "url"),
    ]), "href");
  const rewritten = ts.transform(syntax, [(context) => (source) => {
    const visit = (node: ts.Node): ts.Node => {
      if (ts.isPropertyAccessExpression(node) && ts.isMetaProperty(node.expression) &&
        node.expression.keywordToken === ts.SyntaxKind.ImportKeyword) {
        if (node.name.text === "url") return authoredUrl;
        if (node.name.text === "main") return ts.factory.createBinaryExpression(
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("Bun"), "fileURLToPath"),
            undefined, [authoredUrl]),
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("Bun"), "main"));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitEachChild(source, visit, context);
  }]);
  const result = rewritten.transformed[0];
  if (result === undefined) throw new Error(`plugin entry metadata transformation failed: ${input.file}`);
  const content = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(result);
  rewritten.dispose();
  return content;
}

export function createPluginRuntimePort(input: { readonly projectRoot: string }): PluginRuntimePort {
  const configFile = ts.readConfigFile(join(input.projectRoot, "tsconfig.json"), ts.sys.readFile);
  if (configFile.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, input.projectRoot);
  if (config.errors.length > 0) throw new Error(config.errors.map((entry) =>
    ts.flattenDiagnosticMessageText(entry.messageText, "\n")).join("\n"));
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  return {
    scan: ({ source }) => {
      const scanned = transpiler.scan(source);
      const syntax = ts.createSourceFile("runtime.ts", source, ts.ScriptTarget.Latest, true);
      const hasCapturedBinding = (name: ts.BindingName): boolean => ts.isIdentifier(name)
        ? name.text === "URL" || name.text === "Bun"
        : name.elements.some((element) => ts.isBindingElement(element) && hasCapturedBinding(element.name));
      const hasMetadataBinding = (node: ts.Node): boolean => {
        if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
          hasCapturedBinding(node.name)) return true;
        if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
          ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isImportClause(node) ||
          ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isEnumDeclaration(node) ||
          ts.isModuleDeclaration(node) || ts.isImportEqualsDeclaration(node)) &&
          node.name !== undefined && (node.name.text === "URL" || node.name.text === "Bun")) return true;
        return ts.forEachChild(node, hasMetadataBinding) === true;
      };
      const isMetadataWrite = (node: ts.Node): boolean => {
        const parent = node.parent;
        if (parent === undefined) return false;
        if (ts.isBinaryExpression(parent) && parent.left === node &&
          parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) return true;
        if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
          (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken))
          return true;
        if (ts.isDeleteExpression(parent)) return true;
        if ((ts.isForInStatement(parent) || ts.isForOfStatement(parent)) && parent.initializer === node)
          return true;
        return isMetadataWrite(parent);
      };
      const hasImportMeta = (node: ts.Node): boolean =>
        (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) ||
        ts.forEachChild(node, hasImportMeta) === true;
      const hasUnsupportedImportMeta = (node: ts.Node): boolean => {
        if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
          const parent = node.parent;
          return !ts.isPropertyAccessExpression(parent) || parent.expression !== node ||
            (parent.name.text !== "url" && parent.name.text !== "main") || isMetadataWrite(parent);
        }
        return ts.forEachChild(node, hasUnsupportedImportMeta) === true;
      };
      return {
        imports: scanned.imports.map(({ path }) => path),
        exports: scanned.exports,
        hasUnsupportedImportMeta: hasUnsupportedImportMeta(syntax) ||
          (hasImportMeta(syntax) && hasMetadataBinding(syntax)),
        hasPackageImports: scanned.imports.some(({ path }) =>
          runtimeImportKind({ specifier: path }) === "external" && !isAbsolute(path)),
      };
    },
    declaration: ({ pluginRoot, file }) => {
      const sourceFile = join(pluginRoot, file);
      const options: ts.CompilerOptions = {
        ...config.options, noEmit: false, declaration: true, emitDeclarationOnly: true,
        declarationMap: false, sourceMap: false, outDir: undefined,
      };
      const program = ts.createProgram([sourceFile], options);
      const diagnostics = ts.getPreEmitDiagnostics(program);
      if (diagnostics.length > 0) throw new Error(
        `plugin runtime declaration build failed: ${file}: ${diagnostics.map((entry) =>
          ts.flattenDiagnosticMessageText(entry.messageText, "\n")).join("\n")}`,
      );
      let declaration: string | undefined;
      const emitted = program.emit(undefined, (_path, content, _bom, _error, sources) => {
        if (sources?.some((entry) => relative(sourceFile, entry.fileName) === "")) declaration = content;
      });
      if (emitted.emitSkipped || declaration === undefined) throw new Error(
        `plugin runtime declaration build produced no entry declaration: ${file}`,
      );
      return ownedDeclarationBundle({
        content: declaration, sourceFile, pluginRoot, file, options,
        runtimeModules: transpiler.scan(readFileSync(sourceFile, "utf-8")).imports.map(({ path }) => path),
      });
    },
    bundle: async ({ pluginRoot, file, relativeImports }) => {
      const sourceFile = join(pluginRoot, file);
      const escaped = relativeImports.map((path) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const preserveAuthoredImports: BunPlugin = {
        name: "preserve-authored-plugin-imports",
        setup(builder) {
          builder.onLoad({ filter: /\.[cm]?[jt]s$/ }, ({ path }) => {
            if (relative(sourceFile, path) !== "") return undefined;
            return { contents: entrySourceForCompanion({
              source: readFileSync(sourceFile, "utf-8"), file,
            }), loader: "ts" };
          });
          builder.onResolve({ filter: new RegExp(`^(?:${escaped.join("|")})$`) },
            ({ path, importer }) => relative(sourceFile, importer) === "" ? { path, external: true } : undefined);
        },
      };
      const result = await Bun.build({
        entrypoints: [sourceFile], target: "bun", format: "esm",
        minify: { whitespace: true, syntax: true, identifiers: false },
        plugins: [preserveAuthoredImports],
      });
      const output = result.outputs[0];
      if (!result.success || result.outputs.length !== 1 || output === undefined)
        throw new Error(`plugin runtime dependency build failed: ${file}: ${result.logs.join("\n")}`);
      return output.text();
    },
  };
}

type RuntimeArtifactFileSystem = {
  readonly createDirectory: (input: { readonly path: string }) => Promise<void>;
  readonly writeText: (input: { readonly path: string; readonly content: string }) => Promise<void>;
};

type RuntimeArtifactRequest = { readonly outDir: string; readonly artifact: RuntimeArtifact };

type RuntimeArtifactUnavailable = { readonly kind: "unavailable"; readonly error: RuntimeArtifactFailure };

type RuntimeArtifactWrite = { readonly kind: "written" } | RuntimeArtifactUnavailable;

type RuntimeArtifactPort = { readonly write: (input: RuntimeArtifactRequest) => Promise<RuntimeArtifactWrite> };

type RuntimePreparationFailure = Exclude<ProjectedPluginRuntime, { readonly kind: "prepared" }>;

type RuntimePublication = { readonly kind: "published"; readonly files: readonly string[] } | RuntimePreparationFailure;

function unavailableRuntimeArtifact(input: {
  readonly request: RuntimeArtifactRequest;
  readonly kind: RuntimeArtifactFailure["kind"];
  readonly thrown: unknown;
}): RuntimeArtifactUnavailable {
  return { kind: "unavailable", error: {
    kind: input.kind, outDir: input.request.outDir, file: input.request.artifact.file,
    message: runtimeFailureMessage({ thrown: input.thrown }), writtenFiles: [],
  } };
}

async function writeRuntimeArtifact(input: {
  readonly request: RuntimeArtifactRequest;
  readonly fileSystem: RuntimeArtifactFileSystem;
}): Promise<RuntimeArtifactWrite> {
  const path = join(input.request.outDir, input.request.artifact.file);
  try {
    await input.fileSystem.createDirectory({ path: dirname(path) });
  } catch (thrown) {
    return unavailableRuntimeArtifact({ request: input.request, kind: "artifact-directory-failed", thrown });
  }
  try {
    await input.fileSystem.writeText({ path, content: input.request.artifact.content });
    return { kind: "written" };
  } catch (thrown) {
    return unavailableRuntimeArtifact({ request: input.request, kind: "artifact-write-failed", thrown });
  }
}

export function createPluginRuntimeArtifactPort(input: {
  readonly fileSystem?: RuntimeArtifactFileSystem;
} = {}): RuntimeArtifactPort {
  const fileSystem = input.fileSystem ?? {
    createDirectory: async ({ path }: { readonly path: string }) => { await sourceFileSystem.mkdir(path, { recursive: true }); },
    writeText: ({ path, content }: { readonly path: string; readonly content: string }) => sourceFileSystem.writeFile(path, content),
  };
  return { write: (request) => writeRuntimeArtifact({ request, fileSystem }) };
}

async function publishRuntimeArtifact(input: {
  readonly publication: RuntimePublication;
  readonly request: RuntimeArtifactRequest;
  readonly port: RuntimeArtifactPort;
}): Promise<RuntimePublication> {
  if (input.publication.kind !== "published") return input.publication;
  const written = await attemptRuntimeArtifactWrite(input);
  if (written.kind === "unavailable") return {
    kind: "unavailable", error: { ...written.error, writtenFiles: input.publication.files },
  };
  return { kind: "published", files: [...input.publication.files, input.request.artifact.file] };
}

async function attemptRuntimeArtifactWrite(input: {
  readonly request: RuntimeArtifactRequest;
  readonly port: RuntimeArtifactPort;
}): Promise<RuntimeArtifactWrite> {
  try {
    return await input.port.write(input.request);
  } catch (thrown) {
    return unavailableRuntimeArtifact({ request: input.request, kind: "artifact-provider-failed", thrown });
  }
}

export function publishPluginRuntimeArtifacts(input: {
  readonly outDir: string;
  readonly prepared: ProjectedPluginRuntime;
  readonly port: RuntimeArtifactPort;
}): Promise<RuntimePublication> {
  if (input.prepared.kind !== "prepared") return Promise.resolve(input.prepared);
  return input.prepared.artifacts.reduce<Promise<RuntimePublication>>(async (previous, artifact) =>
    publishRuntimeArtifact({ publication: await previous, request: { outDir: input.outDir, artifact }, port: input.port }),
  Promise.resolve({ kind: "published", files: [] }));
}

export type { DeclarationBundle, PluginRuntimePort, PluginRuntimeSourceFailure, PluginRuntimeSourceFileSystem, PluginRuntimeSourcePort, PluginRuntimeSourceRead, PluginRuntimeSourceRequest, PreparedRuntime, ProjectedPluginRuntime, RuntimeArtifact, RuntimeScan, RuntimeSource, UnavailablePluginRuntimeSource, RuntimeCompilerPort, RuntimeCompilerFactory, RuntimeCompilerAvailability, RuntimeCompilation, RuntimeCompilationFailure, RuntimeConfigurationFailure, RuntimeArtifactFileSystem, RuntimeArtifactPort, RuntimeArtifactWrite, RuntimeArtifactFailure, RuntimeArtifactUnavailable, RuntimePreparationFailure, RuntimePublication };
