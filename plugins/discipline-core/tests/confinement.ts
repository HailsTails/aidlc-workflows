import { importsIn, type ModuleImport } from "../core/check/piece-import-rules.ts";
import { createPathPort, type PathPort } from "../core/platform-ports/path-port.ts";

export type ConfinementVerdict = "allowed" | "outside";

export type ImportAllowance = (request: { readonly moduleImport: ModuleImport }) => ConfinementVerdict;

export type ImportOutside = ModuleImport & { readonly file: string };

export type PathCallsOutside = {
  readonly called: "at least once" | "never";
  readonly outside: readonly string[];
};

const RELATIVE_SPECIFIER = /^\.\.?\//;

const PACKAGE_OR_COMPUTED_SPECIFIER = /^[^.]/;

const NODE_BUILTIN_SPECIFIER = /^node:/;

const COMPUTED_SPECIFIER = /[^\w@/.:-]/;

const STATIC_FORMS: readonly ModuleImport["form"][] = ["value", "type-only"];

const INSTALL_ROOT = "/install";

export const relativeImport: ImportAllowance = ({ moduleImport }) =>
  RELATIVE_SPECIFIER.test(moduleImport.specifier) && STATIC_FORMS.includes(moduleImport.form) ? "allowed" : "outside";

export const relativeImportOfAnyForm: ImportAllowance = ({ moduleImport }) =>
  RELATIVE_SPECIFIER.test(moduleImport.specifier) ? "allowed" : "outside";

export const nodeBuiltinImport: ImportAllowance = ({ moduleImport }) =>
  NODE_BUILTIN_SPECIFIER.test(moduleImport.specifier) && STATIC_FORMS.includes(moduleImport.form)
    ? "allowed"
    : "outside";

export const computedModuleLoad: ImportAllowance = ({ moduleImport }) =>
  COMPUTED_SPECIFIER.test(moduleImport.specifier) && moduleImport.form === "dynamic" ? "allowed" : "outside";

export const packageOrComputedImport: ImportAllowance = ({ moduleImport }) =>
  PACKAGE_OR_COMPUTED_SPECIFIER.test(moduleImport.specifier) ? "allowed" : "outside";

export const packageImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && STATIC_FORMS.includes(moduleImport.form) ? "allowed" : "outside";

export const packageTypeImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && moduleImport.form === "type-only" ? "allowed" : "outside";

const reachOf = (request: {
  readonly importingPath: PathPort;
  readonly reach: RegExp;
  readonly specifier: string;
}): ConfinementVerdict => {
  const location = request.importingPath.relative({ from: INSTALL_ROOT, to: request.specifier });
  return location.relation === "within-root" && request.reach.test(location.path) ? "allowed" : "outside";
};

export const relativeImportReaching = (request: {
  readonly importingFolder: string;
  readonly reach: RegExp;
}): ImportAllowance => {
  const importingPath = createPathPort({
    flavour: "posix",
    workingDirectory: () => `${INSTALL_ROOT}/${request.importingFolder}`,
  });
  return ({ moduleImport }) =>
    RELATIVE_SPECIFIER.test(moduleImport.specifier)
      ? reachOf({ importingPath, reach: request.reach, specifier: moduleImport.specifier })
      : "outside";
};

const allowanceOf = (request: {
  readonly allowed: readonly ImportAllowance[];
  readonly moduleImport: ModuleImport;
}): ConfinementVerdict =>
  request.allowed.some((allows) => allows({ moduleImport: request.moduleImport }) === "allowed") ? "allowed" : "outside";

export const importsOutside = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly allowed: readonly ImportAllowance[];
}): readonly ImportOutside[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importsIn({ text })
      .filter((moduleImport) => allowanceOf({ allowed: request.allowed, moduleImport }) === "outside")
      .map((moduleImport) => ({ file, ...moduleImport })),
  );

export const filesNotMatching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly pattern: RegExp;
}): readonly string[] =>
  Object.entries(request.sources)
    .filter(([, text]) => !request.pattern.test(text))
    .map(([file]) => file);

const pathCallVerdict = (request: {
  readonly path: PathPort;
  readonly root: string;
  readonly observed: string;
  readonly paths: RegExp;
}): ConfinementVerdict => {
  const location = request.path.relative({ from: request.root, to: request.observed });
  return location.relation === "within-root" && request.paths.test(location.path) ? "allowed" : "outside";
};

export const pathCallsOutside = (request: {
  readonly path: PathPort;
  readonly root: string;
  readonly calls: readonly (readonly [{ readonly path: string }])[];
  readonly paths: RegExp;
}): PathCallsOutside => ({
  called: request.calls.length === 0 ? "never" : "at least once",
  outside: request.calls
    .map(([call]) => call.path)
    .filter((observed) => pathCallVerdict({ ...request, observed }) === "outside"),
});
