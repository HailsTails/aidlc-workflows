#!/usr/bin/env bun
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bridgeMapFrom, bridgeMapJson, bridgeMapMarkdown } from "./bridge-map.ts";
import { entryLine, gitIn, removalLine, type Git, type Identity } from "./git.ts";
import { pinFactsFrom, type PinFacts } from "./pin-facts.ts";
import { isStripped, SHAPE_PLAN, type OptionalPatch, type ShapePlan } from "./shape-plan.ts";

const TOOLING_ROOT = resolve(import.meta.dir, "..");
const BRIDGE_MAP_TOKEN = "{{bridge-map}}";
const OPTIONAL_PATCH_NOTES_TOKEN = "{{optional-patch-notes}}\n\n";
const PIN_TOKEN = "{{pin}}";
const RELEASE_TOKEN = "{{release}}";
const PREVIOUS_RELEASE_TOKEN = "{{previous-release}}";
const GOLDEN_FILE_COUNT_TOKEN = "{{golden-file-count}}";
const BLOB_MODE = "100644";

const USAGE = [
  "usage: bun src/regenerate.ts --repository <aidlc-workflows checkout> --pin <upstream commit> [options]",
  "  --pin <ref>         upstream commit the foundation is built on and the shape is measured against",
  "  --foundation <ref>  source of the rebuilt tree (default origin/rebuild/foundation)",
  "  --parent <ref>      parent of the new commit (default: the foundation ref)",
  "  --branch <name>     branch to point at the new commit (default upstream-shape)",
  "  --verify            only compare the regenerated tree with the branch; exit 1 on drift",
  "  --without <name>    leave out an optional patch (repeatable), e.g. gitleaks-golden-allowlist",
  "Twin parented on the pin:",
  "  bun src/regenerate.ts --repository <checkout> --pin <commit> --parent <commit> --branch upstream-shape-on-pin",
  "The commit is authored and committed by HailsTails <9475175+HailsTails@users.noreply.github.com>,",
  "whatever the git config says, with the foundation tip's dates and no Co-Authored-By trailer.",
].join("\n");

const CONTRIBUTOR = { name: "HailsTails", email: "9475175+HailsTails@users.noreply.github.com" } as const;

const contributedOn = (date: string): Identity => ({ ...CONTRIBUTOR, date });

const messageFor = (facts: PinFacts): string =>
  [
    `Rebuild the build side by bounded context, with output parity against ${facts.shortPin}`,
    "",
    "The packager, harness manifests and emitters now run through src/, one folder",
    "per bounded context. core/, plugins/ and every shipped harness file are",
    "unchanged.",
    "",
    "scripts/parity/ records and checks the goldens in tests/golden/, recorded on",
    `unmodified ${facts.shortPin}. PARITY.md has the commands and the bridge map.`,
    "",
  ].join("\n");

type Options = {
  readonly repository: string;
  readonly foundation: string;
  readonly pin: string;
  readonly parent: string | undefined;
  readonly branch: string;
  readonly verify: boolean;
  readonly without: readonly string[];
};

const valueOf = (argv: readonly string[], flag: string): string | undefined =>
  argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined;

const optionsFrom = (argv: readonly string[]): Options | undefined => {
  const repository = valueOf(argv, "--repository");
  const pin = valueOf(argv, "--pin");
  if (repository === undefined || pin === undefined) return undefined;
  return {
    repository: resolve(repository),
    foundation: valueOf(argv, "--foundation") ?? "origin/rebuild/foundation",
    pin,
    parent: valueOf(argv, "--parent"),
    branch: valueOf(argv, "--branch") ?? "upstream-shape",
    verify: argv.includes("--verify"),
    without: argv.flatMap((flag, index) => (flag === "--without" ? [argv[index + 1] ?? ""] : [])),
  };
};

const toolingFile = (path: string): string => readFileSync(join(TOOLING_ROOT, path), "utf8").replaceAll("\r\n", "\n");

const movedEntries = (git: Git, plan: ShapePlan, foundation: string): readonly string[] => {
  const entries = git.entriesAt(foundation, plan.movedFiles.map((file) => file.from));
  return plan.movedFiles.map((file) => {
    const meta = entries.get(file.from);
    if (meta === undefined || !meta.endsWith(` ${file.blob}`)) {
      throw new Error(`${file.from} changed on ${foundation} (expected blob ${file.blob}, found ${meta ?? "nothing"}): review the move before regenerating`);
    }
    return entryLine(meta, file.to);
  });
};

const stripLayers = (git: Git, plan: ShapePlan): void =>
  git.updateIndex(git.indexedPaths().filter((path) => isStripped(plan, path)).map(removalLine));

const pinFiles = (git: Git, plan: ShapePlan, pin: string): void => {
  const pinned = git.entriesAt(pin, plan.pinnedFiles);
  git.updateIndex(
    plan.pinnedFiles.map((path) => {
      const meta = pinned.get(path);
      return meta === undefined ? removalLine(path) : entryLine(meta, path);
    }),
  );
};

const applyPatches = (git: Git, plan: ShapePlan): void => {
  const folder = join(TOOLING_ROOT, plan.patchFolder);
  for (const name of readdirSync(folder).filter((file) => file.endsWith(".patch")).sort()) {
    git.applyToIndex(join(folder, name));
  }
};

const includedOptionalPatches = (plan: ShapePlan, without: readonly string[]): readonly OptionalPatch[] => {
  const unknown = without.filter((name) => !plan.optionalPatches.some((patch) => patch.name === name));
  if (unknown.length > 0) throw new Error(`unknown optional patch: ${unknown.join(", ")}`);
  return plan.optionalPatches.filter((patch) => !without.includes(patch.name));
};

const applyOptionalPatches = (git: Git, patches: readonly OptionalPatch[]): void => {
  for (const patch of patches) git.applyToIndex(join(TOOLING_ROOT, patch.file));
};

const optionalPatchNotes = (patches: readonly OptionalPatch[]): string =>
  patches.map((patch) => `${patch.readmeNote}\n\n`).join("");

const blobLine = (git: Git, path: string, content: string, mode: string): string =>
  entryLine(`${mode} ${git.storeBlob(content)}`, path);

const withPinFacts = (template: string, facts: PinFacts): string =>
  template
    .replaceAll(PIN_TOKEN, facts.shortPin)
    .replaceAll(RELEASE_TOKEN, facts.release)
    .replaceAll(PREVIOUS_RELEASE_TOKEN, facts.previousRelease)
    .replaceAll(GOLDEN_FILE_COUNT_TOKEN, facts.goldenFileCount.toLocaleString("en-US"));

const addFiles = async (request: {
  readonly git: Git;
  readonly plan: ShapePlan;
  readonly foundation: string;
  readonly patches: readonly OptionalPatch[];
  readonly facts: PinFacts;
}): Promise<void> => {
  const { git, plan, foundation, patches, facts } = request;
  const map = await bridgeMapFrom(git.show(foundation, plan.bridgeMapSource));
  const readme = withPinFacts(toolingFile(plan.readmeTemplate), facts)
    .replace(BRIDGE_MAP_TOKEN, bridgeMapMarkdown(map))
    .replace(OPTIONAL_PATCH_NOTES_TOKEN, optionalPatchNotes(patches));
  git.updateIndex([
    ...plan.addedFiles.map((file) => blobLine(git, file.path, toolingFile(file.source), file.mode)),
    blobLine(git, plan.bridgeMapPath, bridgeMapJson(map), BLOB_MODE),
    blobLine(git, plan.readmePath, readme, BLOB_MODE),
  ]);
};

const shapedTree = async (git: Git, options: Options, facts: PinFacts): Promise<string> => {
  git.readTree(options.foundation);
  const moves = movedEntries(git, SHAPE_PLAN, options.foundation);
  stripLayers(git, SHAPE_PLAN);
  git.updateIndex(moves);
  pinFiles(git, SHAPE_PLAN, options.pin);
  applyPatches(git, SHAPE_PLAN);
  const optional = includedOptionalPatches(SHAPE_PLAN, options.without);
  applyOptionalPatches(git, optional);
  await addFiles({ git, plan: SHAPE_PLAN, foundation: options.foundation, patches: optional, facts });
  return git.writeTree();
};

const verify = (git: Git, options: Options, tree: string): number => {
  const current = git.treeOf(options.branch);
  const same = current === tree;
  process.stdout.write(`${options.branch}: ${same ? "matches" : "drifted from"} the regenerated tree ${tree}\n`);
  return same ? 0 : 1;
};

const commit = (git: Git, options: Options, tree: string, facts: PinFacts): number => {
  const foundation = git.resolve(options.foundation);
  const parent = git.resolve(options.parent ?? foundation);
  const dates = git.identityOf(foundation);
  const sha = git.commitTree({
    tree,
    parent,
    message: messageFor(facts),
    author: contributedOn(dates.author.date),
    committer: contributedOn(dates.committer.date),
  });
  git.updateBranch(options.branch, sha);
  process.stdout.write(`${options.branch} -> ${sha} (tree ${tree}, parent ${parent})\n`);
  return 0;
};

const main = async (): Promise<number> => {
  const options = optionsFrom(Bun.argv.slice(2));
  if (options === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const indexFolder = mkdtempSync(join(tmpdir(), "upstream-shape-index-"));
  try {
    const git = gitIn(options.repository, join(indexFolder, "index"));
    const facts = pinFactsFrom({ git, pin: options.pin, foundation: options.foundation, sources: SHAPE_PLAN.pinSources });
    const tree = await shapedTree(git, options, facts);
    return options.verify ? verify(git, options, tree) : commit(git, options, tree, facts);
  } finally {
    rmSync(indexFolder, { recursive: true, force: true });
  }
};

process.exitCode = await main();
