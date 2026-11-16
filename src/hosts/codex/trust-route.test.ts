import { expect, mock, test } from "bun:test";
import { createRecordingTerminal } from "../../kernel/fixtures/terminal.fake.ts";
import { codexTrustRoutes } from "./trust-route.ts";

const usage = "usage: package.ts codex trust --project <abs-dir> [--hooks-json <abs-path>]\n";
const bindings = () => ({ terminal: createRecordingTerminal(),
  copyTokens: { ["INVOKE"]: "bun .custom/tools/aidlc.ts", ["TRUSTED_NAMESPACE"]: "fixture", ["TOOL_PREFIX"]: "bun .custom/tools/" },
  settings: { extendedSubprocessTimeoutMs: 12000, hookTrust: mock(() => "fixed-hash") },
});

test.each([
  ["/project", "/project/.codex/hooks.json"],
  ["C:\\project", "C:\\project\\.codex\\hooks.json"],
  ["//server/share/project", "\\\\server\\share\\project\\.codex\\hooks.json"],
])("trust renders the installer recipe for project %s through the supplied capabilities", async (project, expectedPath) => {
  const ports = bindings();
  const routes = codexTrustRoutes(ports);
  expect(routes).toMatchObject([{ verb: ["codex", "trust"] }]);
  expect(await routes[0]?.run(["--project", project])).toBe(0);
  expect(ports.terminal.errors()).toEqual([]);
  expect(ports.terminal.output()).toHaveLength(1);
  expect(ports.terminal.output()[0]).toContain(`${JSON.stringify(`${expectedPath}:session_start:0:0`)}]\ntrusted_hash = "fixed-hash"`);
  expect(ports.terminal.output()[0]).toEndWith("\n\n");
  expect(ports.settings.hookTrust).toHaveBeenNthCalledWith(1, {
    event: "session_start", command: "bun .custom/tools/aidlc.ts fixture adapter codex session-start",
    timeoutSeconds: 12, matcher: undefined,
  });
});

test("an explicit hooks-json spelling is used verbatim, with flags in either order", async () => {
  const ports = bindings();
  expect(await codexTrustRoutes(ports)[0]?.run(["--hooks-json", "C:/hooks/../exact.json", "--project", "/project"])).toBe(0);
  expect(ports.terminal.output()[0]).toContain('"C:/hooks/../exact.json:session_start:0:0"]\ntrusted_hash = "fixed-hash"');
  expect(ports.terminal.errors()).toEqual([]);
});

test.each([
  [[], "--project is required"],
  [["--other", "/project"], 'unknown argument "--other"'],
  [["--project"], "--project requires an absolute path"],
  [["--project", "--hooks-json"], "--project requires an absolute path"],
  [["--project", "C:proj"], "--project must be a fully qualified absolute path"],
  [["--project", "\\\\server"], "--project must be a fully qualified absolute path"],
  [["--project", "//server"], "--project must be a fully qualified absolute path"],
  [["--project", "\\relative"], "--project must be a fully qualified absolute path"],
  [["--project", "/one", "--project", "/two"], "--project may be specified only once"],
  [["--project", "/one", "--hooks-json"], "--hooks-json requires an absolute path"],
  [["--project", "/one", "--hooks-json", "relative.json"], "--hooks-json must be a fully qualified absolute path"],
  [["--project", "/one", "--hooks-json", "/one.json", "--hooks-json", "/two.json"], "--hooks-json may be specified only once"],
  [["--project", "/one", "--project", "/two", "--other", "/three"], "--project may be specified only once"],
] as const)("argument refusal preserves reason, usage and empty stdout: %j", async (argv, reason) => {
  const ports = bindings();
  expect(await codexTrustRoutes(ports)[0]?.run(argv)).toBe(1);
  expect(ports.terminal.errors()).toEqual([`codex trust: ${reason}\n`, usage]);
  expect(ports.terminal.output()).toEqual([]);
  expect(ports.settings.hookTrust).not.toHaveBeenCalled();
});

test("a trustEntries refusal keeps the legacy reason-only stderr without argument usage", async () => {
  const ports = bindings();
  expect(await codexTrustRoutes({ ...ports, copyTokens: { ...ports.copyTokens, ["TRUSTED_NAMESPACE"]: "" } })[0]
    ?.run(["--project", "/project"])).toBe(1);
  expect(ports.terminal.errors()).toEqual(["trusted route namespace is required\n"]);
  expect(ports.terminal.output()).toEqual([]);
  expect(ports.settings.hookTrust).not.toHaveBeenCalled();
});

test("null invocation refuses before the trust capability is called", async () => {
  const ports = bindings();
  expect(await codexTrustRoutes({ ...ports, copyTokens: { ...ports.copyTokens, ["INVOKE"]: null } })[0]
    ?.run(["--project", "/project"])).toBe(1);
  expect(ports.terminal.errors()).toEqual(["trusted route invocation is required\n"]);
  expect(ports.terminal.output()).toEqual([]);
  expect(ports.settings.hookTrust).not.toHaveBeenCalled();
});

test("null namespace follows the existing trustEntries refusal without touching the hash capability", async () => {
  const ports = bindings();
  expect(await codexTrustRoutes({ ...ports, copyTokens: { ...ports.copyTokens, ["TRUSTED_NAMESPACE"]: null } })[0]
    ?.run(["--project", "/project"])).toBe(1);
  expect(ports.terminal.errors()).toEqual(["trusted route namespace is required\n"]);
  expect(ports.terminal.output()).toEqual([]);
  expect(ports.settings.hookTrust).not.toHaveBeenCalled();
});
