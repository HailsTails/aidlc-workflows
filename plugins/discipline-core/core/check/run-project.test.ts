import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { type ProjectRequest, runProject } from "./run-project.ts";

const SELECTION_PATH = "/repo/disciplines.json";
const EXCEPTIONS_PATH = "/repo/discipline-exceptions.json";
const DISCIPLINE_PATH = "/install/rules/CD-14/discipline.json";
const PIECE_PATH = "/install/mechanisms/walker/CD-14/piece.json";
const RUNNER_PATH = "/install/mechanisms/walker/runner/runner.ts";

type FakeFile = {
  readonly read: Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;
  readonly presence: "present" | "absent";
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","disciplines.json"]': SELECTION_PATH,
  '["/repo","discipline-exceptions.json"]': EXCEPTIONS_PATH,
  '["/install","rules","CD-14","discipline.json"]': DISCIPLINE_PATH,
  '["/install","mechanisms","walker","CD-14","piece.json"]': PIECE_PATH,
  '["/install","mechanisms","walker","CD-14"]': "/install/mechanisms/walker/CD-14",
  '["/install","mechanisms","walker","runner","runner.ts"]': RUNNER_PATH,
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  [PIECE_PATH]: "/install/mechanisms/walker/CD-14",
  [DISCIPLINE_PATH]: "/install/rules/CD-14",
  [RUNNER_PATH]: "/install/mechanisms/walker/runner",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => z.string().parse(JOINED_PATHS[JSON.stringify(segments)]),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => z.string().parse(DIRECTORIES[path]),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => absolutePathSchema.parse(path),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const DISCIPLINE = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    {
      kind: "mechanical",
      id: "class-syntax",
      summary: "no class syntax",
      mechanisms: ["walker"],
      anchor: { kind: "keyword", keyword: "class" },
      cases: {
        flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
        allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
      },
    },
  ],
});

const PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "walker",
  clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
});

const INSTALL: Readonly<Record<string, FakeFile>> = {
  [SELECTION_PATH]: presentFile({
    text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "walker" } }),
  }),
  [EXCEPTIONS_PATH]: ABSENT_FILE,
  [DISCIPLINE_PATH]: presentFile({ text: DISCIPLINE }),
  [PIECE_PATH]: presentFile({ text: PIECE }),
  [RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
};

const standaloneRunner = (): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const GIT: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: z.array(repoPathSchema).parse(["src/a.ts"]),
  }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
};

const projectRequest = (overrides: Partial<ProjectRequest>): ProjectRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  installRoot: absolutePathSchema.parse("/install"),
  fileText: fileTextOver(INSTALL),
  modules: modulesLoading({ runner: standaloneRunner() }),
  path: TABLE_PATH,
  git: GIT,
  ...overrides,
});

describe("runProject", () => {
  it("returns no projection writes with a standalone runner, writing no file and running nothing", async () => {
    const fileText = fileTextOver(INSTALL);
    const runner = standaloneRunner();
    const writes = await runProject(projectRequest({ fileText, modules: modulesLoading({ runner }) }));
    expect({
      writes,
      fileWrites: vi.mocked(fileText.write).mock.calls,
      runCalls: vi.mocked(runner.run).mock.calls,
      conformCalls: vi.mocked(runner.conform).mock.calls,
    }).toEqual({
      writes: { outcome: "ok", value: [] },
      fileWrites: [],
      runCalls: [],
      conformCalls: [],
    });
  });

  it("loads the runner module once from the install's mechanism runner path", async () => {
    const modules = modulesLoading({ runner: standaloneRunner() });
    const writes = await runProject(projectRequest({ modules }));
    expect({ writes, loads: vi.mocked(modules.load).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [] },
      loads: [[{ path: RUNNER_PATH }]],
    });
  });

  it("is not a load failure when the exceptions file holds an invalid record", async () => {
    await expect(
      runProject(
        projectRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [EXCEPTIONS_PATH]: presentFile({
              text: JSON.stringify({
                version: 1,
                exceptions: [{ kind: "authorised-location", clause: "CD-15#no-for-of", file: "src/a.ts", reason: "loop" }],
              }),
            }),
          }),
        }),
      ),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("is file-malformed for a disciplines.json that is not JSON", async () => {
    await expect(
      runProject(projectRequest({ fileText: fileTextOver({ ...INSTALL, [SELECTION_PATH]: presentFile({ text: "{" }) }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: SELECTION_PATH } });
  });

  it("is file-malformed for a discipline-exceptions.json with an unknown exception kind", async () => {
    await expect(
      runProject(
        projectRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [EXCEPTIONS_PATH]: presentFile({
              text: JSON.stringify({ version: 1, exceptions: [{ kind: "blanket-waiver", clause: "CD-14#class-syntax" }] }),
            }),
          }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: EXCEPTIONS_PATH } });
  });

  it("is runner-invalid for a runner export whose exception path is outside every path", async () => {
    await expect(
      runProject(projectRequest({ modules: modulesLoading({ runner: { ...standaloneRunner(), exceptionPath: "unknown-path" } }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid", mechanism: "walker" } });
  });
});
