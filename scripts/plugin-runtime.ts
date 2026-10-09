import { basename, dirname, isAbsolute, join, posix, relative, sep } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { build, type Plugin } from "esbuild";
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
type PreparedRuntime =
  | { readonly kind: "prepared"; readonly artifacts: readonly RuntimeArtifact[] }
  | { readonly kind: "refused"; readonly message: string };

export async function preparePluginRuntimeArtifacts(input: {
  readonly pluginRoot: string;
  readonly files: readonly string[];
  readonly sources: readonly RuntimeSource[];
  readonly port: PluginRuntimePort;
}): Promise<PreparedRuntime> {
  return input.sources.reduce<Promise<PreparedRuntime>>(async (previous, entry) => {
    const prepared = await previous;
    if (prepared.kind === "refused") return prepared;
    const scan = input.port.scan({ source: entry.source });
    if (!scan.hasPackageImports) return prepared;
    if (scan.hasUnsupportedImportMeta) return {
      kind: "refused",
      message: `plugin runtime companion would change import.meta semantics: ${entry.file}`,
    };
    const stem = entry.file.replace(/\.[cm]?[jt]s$/, "");
    const runtimeFile = `${stem}.runtime.js`;
    const declarationFile = `${stem}.runtime.d.ts`;
    const occupied = [...input.files, ...prepared.artifacts.map(({ file }) => file)];
    const collision = [runtimeFile, declarationFile].find((file) => occupied.includes(file));
    if (collision !== undefined) return {
      kind: "refused",
      message: `plugin runtime companion collides with projected file: ${collision}`,
    };
    const declaration = input.port.declaration({ pluginRoot: input.pluginRoot, file: entry.file });
    const declarationCollision = declaration.companions.find((artifact) =>
      input.files.includes(artifact.file) || prepared.artifacts.some((prior) =>
        prior.file === artifact.file && prior.content !== artifact.content));
    if (declarationCollision !== undefined) return {
      kind: "refused", message: `plugin declaration companion collides with projected file: ${declarationCollision.file}`,
    };
    const runtime = await input.port.bundle({
      pluginRoot: input.pluginRoot,
      file: entry.file,
      relativeImports: scan.imports.filter((path) => path.startsWith(".")),
    });
    const leaf = runtimeFile.split("/").at(-1);
    const facade = `export * from "./${leaf}";\n` +
      (scan.exports.includes("default") ? `export { default } from "./${leaf}";\n` : "");
    return {
      kind: "prepared",
      artifacts: [...prepared.artifacts,
        { file: entry.file, content: facade },
        { file: runtimeFile, content: runtime },
        { file: declarationFile, content: declaration.content },
        ...declaration.companions.filter((artifact) => !prepared.artifacts.some((prior) => prior.file === artifact.file)),
      ],
    };
  }, Promise.resolve({ kind: "prepared", artifacts: [] }));
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
      if (module.startsWith("node:") || module === "bun") continue;
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
    if (module.startsWith(".") || module.startsWith("node:") || module === "bun") continue;
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
          !path.startsWith(".") && !path.startsWith("node:") && path !== "bun" && !isAbsolute(path)),
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
        if (sources?.some((entry) => entry.fileName === sourceFile)) declaration = content;
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
      const preserveAuthoredImports: Plugin = {
        name: "preserve-authored-plugin-imports",
        setup(builder) {
          builder.onResolve({ filter: /^aidlc:runtime-location$/ }, () => ({
            path: "runtime-location", namespace: "aidlc-runtime-location",
          }));
          builder.onLoad({ filter: /.*/, namespace: "aidlc-runtime-location" }, () => ({
            contents: "export const __dirname = import.meta.dirname; export const __filename = import.meta.filename;",
            loader: "js",
          }));
          builder.onLoad({ filter: /\.[cm]?[jt]s$/ }, ({ path }) => {
            if (path !== sourceFile) return undefined;
            return { resolveDir: dirname(sourceFile), contents: entrySourceForCompanion({
              source: readFileSync(sourceFile, "utf-8"), file,
            }), loader: "ts" };
          });
          builder.onResolve({ filter: new RegExp(`^(?:${escaped.join("|")})$`) },
            ({ path, importer }) => importer === sourceFile ? { path, external: true } : undefined);
        },
      };
      const result = await build({
        absWorkingDir: input.projectRoot, entryPoints: [sourceFile], bundle: true, platform: "node", format: "esm",
        target: "esnext", write: false, external: ["bun"], conditions: ["bun"],
        minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false,
        inject: ["aidlc:runtime-location"], mainFields: ["module", "main"],
        plugins: [preserveAuthoredImports],
      });
      const output = result.outputFiles[0];
      if (result.outputFiles.length !== 1 || output === undefined)
        throw new Error(`plugin runtime dependency build produced no single companion: ${file}`);
      return output.text;
    },
  };
}

export type { DeclarationBundle, PluginRuntimePort, PreparedRuntime, RuntimeArtifact, RuntimeScan, RuntimeSource };
