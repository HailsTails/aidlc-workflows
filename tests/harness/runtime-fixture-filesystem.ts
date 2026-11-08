import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

export type RuntimeFixtureLocation = { readonly root: string; readonly relative: string };
export type RuntimeFixtureSetup = { readonly prefix: string; readonly sources?: readonly string[]; readonly dependencies?: "repository-link" };
export type RuntimeFixtureFilesystem = {
  readonly temporaryRoot: string;
  readonly cleanup: () => void;
  readonly create: (setup: RuntimeFixtureSetup) => string;
  readonly remove: (input: { readonly root: string }) => void;
  readonly path: (location: RuntimeFixtureLocation) => string;
  readonly read: (location: RuntimeFixtureLocation) => string;
  readonly write: (input: RuntimeFixtureLocation & { readonly text: string }) => void;
  readonly observe: (path: string) => { readonly presence: "present" | "absent"; readonly parent: string; readonly grandparent: string };
  readonly relationship: (input: { readonly root: string; readonly target: string }) => "same" | "inside" | "outside";
  readonly temporaryEntries: (prefix: string) => readonly string[];
};
type FixtureScope = { readonly live: Set<string>; readonly released: Set<string>; readonly repository: string; readonly temporary: string };
const within = ({ root, target }: { readonly root: string; readonly target: string }) => target === root || target.startsWith(root + sep);
const ordinaryParents = ({ root, target }: { readonly root: string; readonly target: string }): void => {
  if (target !== root) ordinaryParents({ root, target: dirname(target) });
  if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("Runtime fixture operations reject linked paths");
};
const relativeFixturePath = ({ root, relative }: RuntimeFixtureLocation): string => {
  const target = resolve(root, relative);
  if (isAbsolute(relative) || !within({ root, target })) throw new Error("Runtime fixture paths must remain inside the requested root");
  ordinaryParents({ root, target });
  return target;
};
const ownedFixturePath = ({ scope, location }: { readonly scope: FixtureScope; readonly location: RuntimeFixtureLocation }): string => {
  const root = resolve(location.root);
  const owner = [...scope.live].find(parent => within({ root: parent, target: root }));
  if (owner === undefined) throw new Error("Runtime fixture operations require a live owned root");
  ordinaryParents({ root: owner, target: root });
  return relativeFixturePath({ root, relative: location.relative });
};
const removeFixture = ({ scope, root }: { readonly scope: FixtureScope; readonly root: string }): void => {
  if (scope.released.has(root)) return;
  if (!scope.live.has(root)) throw new Error("Runtime fixture cleanup requires an allocated root");
  rmSync(root, { recursive: true, force: true });
  scope.live.delete(root);
  scope.released.add(root);
};
const populateFixture = ({ scope, root, setup }: { readonly scope: FixtureScope; readonly root: string; readonly setup: RuntimeFixtureSetup }): void => {
  (setup.sources ?? []).forEach(relative => {
    const source = relativeFixturePath({ root: scope.repository, relative });
    if (source === scope.repository) throw new Error("Runtime fixtures copy named repository entries only");
    const target = ownedFixturePath({ scope, location: { root, relative } });
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
  });
  if (setup.dependencies === "repository-link") symlinkSync(join(scope.repository, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
};
const createFixture = ({ scope, setup }: { readonly scope: FixtureScope; readonly setup: RuntimeFixtureSetup }): string => {
  if (!/^[a-z][a-z-]+-$/.test(setup.prefix)) throw new Error("Runtime fixture prefixes must be simple directory names");
  const root = mkdtempSync(join(scope.temporary, setup.prefix));
  scope.live.add(root);
  try { populateFixture({ scope, root, setup }); return root; }
  catch (failure) {
    try { removeFixture({ scope, root }); }
    catch (cleanupFailure) { throw new AggregateError([failure, cleanupFailure], "Runtime fixture setup and cleanup failed"); }
    throw failure;
  }
};
const writeFixture = ({ scope, location, text }: { readonly scope: FixtureScope; readonly location: RuntimeFixtureLocation; readonly text: string }): void => {
  const target = ownedFixturePath({ scope, location });
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
};

// Test fixture storage owns its roots and relative filesystem effects; it does not run product scenarios.
export const createRuntimeFixtureFilesystem = (): RuntimeFixtureFilesystem => {
  const scope: FixtureScope = { live: new Set(), released: new Set(), repository: resolve(import.meta.dir, "../.."), temporary: tmpdir() };
  return {
    temporaryRoot: scope.temporary,
    cleanup: () => { [...scope.live].forEach(root => { removeFixture({ scope, root }); }); },
    create: setup => createFixture({ scope, setup }),
    remove: ({ root }) => removeFixture({ scope, root }),
    path: location => ownedFixturePath({ scope, location }),
    read: location => readFileSync(ownedFixturePath({ scope, location }), "utf8"),
    write: ({ root, relative, text }) => writeFixture({ scope, location: { root, relative }, text }),
    observe: path => ({ presence: existsSync(path) ? "present" : "absent", parent: dirname(path), grandparent: dirname(dirname(path)) }),
    relationship: ({ root, target }) => resolve(root) === resolve(target) ? "same" : within({ root: resolve(root), target: resolve(target) }) ? "inside" : "outside",
    temporaryEntries: prefix => readdirSync(scope.temporary).filter(name => name.startsWith(prefix)).sort(),
  };
};
