import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { requiredEntry } from "../tests/required-entry.ts";
import type { ScratchFilesPort } from "./install-proof-ports.ts";
import { prepareConsumerFixtures } from "./prepare-consumer-fixtures.ts";

const ENCLOSURE = absolutePathSchema.parse("/fixture");
const SOURCE_ROOT = absolutePathSchema.parse("/source");
const CONSUMER_FIXTURE = absolutePathSchema.parse("/source/fixtures");
const PROVIDER_ROOT = absolutePathSchema.parse("/fixture/provider");
const CONSUMERS_ROOT = absolutePathSchema.parse("/fixture/consumers");
const ALPHA = absolutePathSchema.parse("/fixture/consumers/alpha");
const BETA = absolutePathSchema.parse("/fixture/consumers/beta");
const RULE_FILE = absolutePathSchema.parse("/fixture/provider/rules/CD-14/discipline.json");
const PIECE_FILE = absolutePathSchema.parse("/fixture/provider/mechanisms/eslint/CD-14/piece.json");
const RULE_DIRECTORY = absolutePathSchema.parse("/fixture/provider/rules/CD-14");
const PIECE_DIRECTORY = absolutePathSchema.parse("/fixture/provider/mechanisms/eslint/CD-14");
const ALPHA_PROJECTION = absolutePathSchema.parse("/fixture/consumers/alpha/disciplines.eslint.mjs");
const BETA_PROJECTION = absolutePathSchema.parse("/fixture/consumers/beta/disciplines.eslint.mjs");
const PREVIOUS = '"../old-provider.ts"';
const REPLACEMENT = '"../../provider/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts"';
const ORIGINAL_ALPHA = 'import piece from "../old-provider.ts";\nexport default [piece];\nexport const retained = "hand-edited";\n';
const ORIGINAL_BETA = 'import piece from "../old-provider.ts";\nexport default [piece];\n';
const REWRITTEN_ALPHA = 'import piece from "../../provider/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";\nexport default [piece];\nexport const retained = "hand-edited";\n';
const REWRITTEN_BETA = 'import piece from "../../provider/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";\nexport default [piece];\n';

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/fixture","provider"]': PROVIDER_ROOT,
  '["/fixture","consumers"]': CONSUMERS_ROOT,
  '["/fixture/consumers","alpha"]': ALPHA,
  '["/fixture/consumers","beta"]': BETA,
  '["/fixture","consumers","alpha"]': ALPHA,
  '["/fixture","consumers","beta"]': BETA,
  '["/source","rules/CD-14/discipline.json"]': "/source/rules/CD-14/discipline.json",
  '["/source","mechanisms/eslint/CD-14/piece.json"]': "/source/mechanisms/eslint/CD-14/piece.json",
  '["/fixture/provider","rules/CD-14/discipline.json"]': RULE_FILE,
  '["/fixture/provider","mechanisms/eslint/CD-14/piece.json"]': PIECE_FILE,
  '["/fixture","provider","rules/CD-14/discipline.json"]': RULE_FILE,
  '["/fixture","provider","mechanisms/eslint/CD-14/piece.json"]': PIECE_FILE,
  '["/fixture/consumers","alpha/disciplines.eslint.mjs"]': ALPHA_PROJECTION,
  '["/fixture/consumers","beta/disciplines.eslint.mjs"]': BETA_PROJECTION,
  '["/fixture","consumers","alpha/disciplines.eslint.mjs"]': ALPHA_PROJECTION,
  '["/fixture","consumers","beta/disciplines.eslint.mjs"]': BETA_PROJECTION,
};
const RESOLVED_PATHS: Readonly<Record<string, ReturnType<PathPort["resolve"]>>> = {
  "/fixture/provider": { outcome: "ok", value: PROVIDER_ROOT },
  "/fixture/consumers": { outcome: "ok", value: CONSUMERS_ROOT },
  "/fixture/consumers/alpha": { outcome: "ok", value: ALPHA },
  "/fixture/consumers/beta": { outcome: "ok", value: BETA },
  "/fixture/provider/rules/CD-14/discipline.json": { outcome: "ok", value: RULE_FILE },
  "/fixture/provider/mechanisms/eslint/CD-14/piece.json": { outcome: "ok", value: PIECE_FILE },
  "/fixture/provider/rules/CD-14": { outcome: "ok", value: RULE_DIRECTORY },
  "/fixture/provider/mechanisms/eslint/CD-14": { outcome: "ok", value: PIECE_DIRECTORY },
  "/fixture/consumers/alpha/disciplines.eslint.mjs": { outcome: "ok", value: ALPHA_PROJECTION },
  "/fixture/consumers/beta/disciplines.eslint.mjs": { outcome: "ok", value: BETA_PROJECTION },
};
const DIRECTORIES: Readonly<Record<string, string>> = {
  "/fixture/provider/rules/CD-14/discipline.json": RULE_DIRECTORY,
  "/fixture/provider/mechanisms/eslint/CD-14/piece.json": PIECE_DIRECTORY,
};
const PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  resolve: ({ path }) => requiredEntry({ table: RESOLVED_PATHS, key: path }),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};
const REQUEST = {
  enclosure: ENCLOSURE,
  sourceRoot: SOURCE_ROOT,
  consumerFixture: CONSUMER_FIXTURE,
  consumers: [repoPathSchema.parse("alpha"), repoPathSchema.parse("beta")],
  providerFiles: [
    repoPathSchema.parse("rules/CD-14/discipline.json"),
    repoPathSchema.parse("mechanisms/eslint/CD-14/piece.json"),
  ],
  rewrites: [
    { file: repoPathSchema.parse("alpha/disciplines.eslint.mjs"), previous: PREVIOUS, replacement: REPLACEMENT },
    { file: repoPathSchema.parse("beta/disciplines.eslint.mjs"), previous: PREVIOUS, replacement: REPLACEMENT },
  ],
  path: PATH,
};

const scratchWith = (copyTree: ScratchFilesPort["copyTree"]): ScratchFilesPort => ({
  copyTree,
  createTemporaryDirectory: vi.fn<ScratchFilesPort["createTemporaryDirectory"]>(),
  removeTree: vi.fn<ScratchFilesPort["removeTree"]>(),
  removeFile: vi.fn<ScratchFilesPort["removeFile"]>(),
  listTree: vi.fn<ScratchFilesPort["listTree"]>(),
});
const textWith = (request: {
  readonly read: FileTextPort["read"];
  readonly write: FileTextPort["write"];
}): FileTextPort => ({
  ...request,
  exists: vi.fn<FileTextPort["exists"]>(),
});

describe("prepareConsumerFixtures", () => {
  it("copies complete consumer and ordered provider inputs, rewrites imports only, and returns their actual paths", () => {
    const copyTree = vi.fn<ScratchFilesPort["copyTree"]>().mockReturnValue({ outcome: "ok", value: null });
    const read = vi.fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: ORIGINAL_ALPHA })
      .mockReturnValueOnce({ outcome: "ok", value: ORIGINAL_BETA });
    const write = vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined });
    const scratch = scratchWith(copyTree);

    expect(prepareConsumerFixtures({
      ...REQUEST, scratch, fileText: textWith({ read, write }),
    })).toEqual({
      outcome: "ok",
      value: {
        providerRoot: PROVIDER_ROOT,
        consumers: { alpha: ALPHA, beta: BETA },
        providerFiles: {
          "rules/CD-14/discipline.json": { file: RULE_FILE, directory: RULE_DIRECTORY },
          "mechanisms/eslint/CD-14/piece.json": { file: PIECE_FILE, directory: PIECE_DIRECTORY },
        },
      },
    });
    expect(copyTree.mock.calls).toEqual([
      [{ from: "/source/fixtures", to: "/fixture/consumers", disposition: expect.any(Function) }],
      [{ from: "/source/rules/CD-14/discipline.json", to: RULE_FILE, disposition: expect.any(Function) }],
      [{ from: "/source/mechanisms/eslint/CD-14/piece.json", to: PIECE_FILE, disposition: expect.any(Function) }],
    ]);
    expect(read.mock.calls).toEqual([[{ path: ALPHA_PROJECTION }], [{ path: BETA_PROJECTION }]]);
    expect(write.mock.calls).toEqual([
      [{ path: ALPHA_PROJECTION, text: REWRITTEN_ALPHA }],
      [{ path: BETA_PROJECTION, text: REWRITTEN_BETA }],
    ]);
    expect(scratch.createTemporaryDirectory).not.toHaveBeenCalled();
    expect(scratch.removeTree).not.toHaveBeenCalled();
  });

  it("preserves a provider copy failure without copying later inputs or rewriting files", () => {
    const copyTree = vi.fn<ScratchFilesPort["copyTree"]>()
      .mockReturnValueOnce({ outcome: "ok", value: null })
      .mockReturnValueOnce({ outcome: "failed", error: { kind: "effect-failed", detail: "provider copy denied" } });
    const read = vi.fn<FileTextPort["read"]>();
    const write = vi.fn<FileTextPort["write"]>();

    expect(prepareConsumerFixtures({
      ...REQUEST, scratch: scratchWith(copyTree), fileText: textWith({ read, write }),
    })).toEqual({
      outcome: "failed", error: { kind: "effect-failed", detail: "provider copy denied" },
    });
    expect(copyTree.mock.calls).toEqual([
      [{ from: "/source/fixtures", to: "/fixture/consumers", disposition: expect.any(Function) }],
      [{ from: "/source/rules/CD-14/discipline.json", to: RULE_FILE, disposition: expect.any(Function) }],
    ]);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("refuses a copied fixture missing its original import without writing or processing later rewrites", () => {
    const copyTree = vi.fn<ScratchFilesPort["copyTree"]>().mockReturnValue({ outcome: "ok", value: null });
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "export default [];\n" });
    const write = vi.fn<FileTextPort["write"]>();

    expect(prepareConsumerFixtures({
      ...REQUEST, scratch: scratchWith(copyTree), fileText: textWith({ read, write }),
    })).toMatchObject({
      outcome: "failed", error: { kind: "effect-failed", detail: expect.stringContaining(ALPHA_PROJECTION) },
    });
    expect(read).toHaveBeenCalledExactlyOnceWith({ path: ALPHA_PROJECTION });
    expect(write).not.toHaveBeenCalled();
  });

  it("reports the affected copied-file read failure without writing or reading the next fixture", () => {
    const copyTree = vi.fn<ScratchFilesPort["copyTree"]>().mockReturnValue({ outcome: "ok", value: null });
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "failed", error: { kind: "unreadable", path: ALPHA_PROJECTION, detail: "EACCES: fixture unreadable" },
    });
    const write = vi.fn<FileTextPort["write"]>();

    const prepared = prepareConsumerFixtures({
      ...REQUEST, scratch: scratchWith(copyTree), fileText: textWith({ read, write }),
    });
    expect(prepared).toMatchObject({
      outcome: "failed", error: { kind: "effect-failed", detail: expect.stringContaining(ALPHA_PROJECTION) },
    });
    expect(prepared).toMatchObject({
      outcome: "failed", error: { detail: expect.stringContaining("EACCES: fixture unreadable") },
    });
    expect(read).toHaveBeenCalledExactlyOnceWith({ path: ALPHA_PROJECTION });
    expect(write).not.toHaveBeenCalled();
  });

  it("reports the affected copied-file write failure without processing the next fixture", () => {
    const copyTree = vi.fn<ScratchFilesPort["copyTree"]>().mockReturnValue({ outcome: "ok", value: null });
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: ORIGINAL_ALPHA });
    const write = vi.fn<FileTextPort["write"]>().mockReturnValue({
      outcome: "failed", error: { kind: "unwritable", path: ALPHA_PROJECTION, detail: "EROFS: fixture unwritable" },
    });

    const prepared = prepareConsumerFixtures({
      ...REQUEST, scratch: scratchWith(copyTree), fileText: textWith({ read, write }),
    });
    expect(prepared).toMatchObject({
      outcome: "failed", error: { kind: "effect-failed", detail: expect.stringContaining(ALPHA_PROJECTION) },
    });
    expect(prepared).toMatchObject({
      outcome: "failed", error: { detail: expect.stringContaining("EROFS: fixture unwritable") },
    });
    expect(read).toHaveBeenCalledExactlyOnceWith({ path: ALPHA_PROJECTION });
    expect(write).toHaveBeenCalledExactlyOnceWith({ path: ALPHA_PROJECTION, text: REWRITTEN_ALPHA });
  });
});

