import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../../kernel/result.ts";
import { host, path } from "../../../../kernel/fixtures/values.fixture.ts";
import { createRecordingTerminal } from "../../../../kernel/fixtures/terminal.fake.ts";
import type { PackagingRefusal } from "../../../../packaging/domain/artifact.ts";
import { createBuildRoute } from "./build-route.ts";

const claude = host({ name: "claude", directory: ".claude" });
const codex = host({ name: "codex", directory: ".codex" });
const fixture = (refusals: readonly PackagingRefusal[] = []) => {
  const terminal = createRecordingTerminal();
  const build = mock<ReturnType<Parameters<typeof createBuildRoute>[0]["distributions"]>["build"]>(async () => accepted({ record: "recorded" }));
  const check = mock<ReturnType<Parameters<typeof createBuildRoute>[0]["distributions"]>["check"]>(async () => accepted({ problems: [], inputs: "unchanged" }));
  const route = createBuildRoute({ hosts: [codex, claude], refusals, terminal, distributions: () => ({ build, check }) });
  return { route, terminal, build, check };
};

test("the default build uses all admitted hosts in sorted order and a full sweep", async () => {
  const current = fixture();
  expect(current.route.verb).toEqual([]);
  expect(await current.route.run([])).toBe(0);
  expect(current.build).toHaveBeenCalledWith({ hosts: [claude, codex], sweep: "full", refusals: [] });
  expect(current.check).not.toHaveBeenCalled();
});

test("a named --check selects only that host and keeps the existing success text", async () => {
  const current = fixture();
  expect(await current.route.run(["--check", "codex"])).toBe(0);
  expect(current.check).toHaveBeenCalledWith({ hosts: [codex], refusals: [] });
  expect(current.build).not.toHaveBeenCalled();
  expect(current.terminal.output()).toEqual([
    "package --check: deterministic across two independent build(s) for codex.\n",
  ]);
});

test("unknown hosts refuse before any operation and list the admitted names in order", async () => {
  const current = fixture();
  expect(await current.route.run(["missing"])).toBe(1);
  expect(current.terminal.errors()).toEqual(['unknown harness "missing" (have: claude, codex)\n']);
  expect(current.build).not.toHaveBeenCalled();
  expect(current.check).not.toHaveBeenCalled();
});

const refusedHostModes: { readonly argv: readonly string[] }[] = [{ argv: [] }, { argv: ["--check"] }];
test.each(refusedHostModes)("the refused-host list passes unchanged before terminal framing", async ({ argv }) => {
  const refusals: readonly PackagingRefusal[] = [{ kind: "host-build-refused",
    reason: { kind: "invalid-distribution-id", raw: "bad" } }];
  const current = fixture(refusals);
  current.build.mockResolvedValue(refused(refusals));
  current.check.mockResolvedValue(refused(refusals));
  expect(await current.route.run(argv)).toBe(1);
  const called = argv.includes("--check") ? current.check : current.build;
  expect(called.mock.calls[0]?.[0].refusals).toBe(refusals);
  expect(current.terminal.errors()).toEqual([`${JSON.stringify(refusals[0])}\n`,
    "A host in the host table cannot be built. Fix the member each line names in src/cli/host-table.ts.\n"]);
});

test("shared-root failures retain the plain path and owner message", async () => {
  const current = fixture();
  current.build.mockResolvedValue(refused([{ kind: "shared-root-integration-differs", path: path("AGENTS.md"),
    distributions: [claude.distribution, codex.distribution] }]));
  expect(await current.route.run([])).toBe(1);
  expect(current.terminal.errors()).toEqual([
    "shared identical root integration AGENTS.md differs between claude and codex\n",
  ]);
});

test("a check failure prints its total and only the first forty problems", async () => {
  const current = fixture();
  const problems = Array.from({ length: 42 }, (_, index) => `DIFFERS between builds: dist/file-${index}`);
  current.check.mockResolvedValue(accepted({ problems, inputs: "unchanged" }));
  expect(await current.route.run(["--check"])).toBe(1);
  expect(current.terminal.errors()).toEqual(["\npackage --check FAILED (42 problem(s)):\n",
    ...problems.slice(0, 40).map((problem) => `  ${problem}\n`)]);
});

test("a completed build with changed inputs keeps the sources warning and failure status", async () => {
  const current = fixture();
  current.build.mockResolvedValue(accepted({ record: "inputs-changed" }));
  expect(await current.route.run(["codex"])).toBe(1);
  expect(current.build).toHaveBeenCalledWith({ hosts: [codex], refusals: [], sweep: "named" });
  expect(current.terminal.errors()).toEqual([
    "[sources] a packaging input changed while packaging, so the generated trees may mix " +
      "old and new files: run `bun scripts/package.ts` again.\n",
  ]);
});
