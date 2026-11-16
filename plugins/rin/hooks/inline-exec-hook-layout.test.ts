import { afterEach, describe, expect, test } from "vitest";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import {
  hookSource,
  INLINE_EXEC_HOOK,
  installInlineExecHook,
  portsImportedBy,
  relativeImportsOf,
  toolSource,
} from "./inline-exec-hook-layout.ts";
import { invokeBashHook, permissionDecisionFrom } from "./run-hook-process.ts";

const paths = defaultPathOperations();
const files = defaultFileTextPort();

const installRoots: string[] = [];

const scratchRoot = (): string => {
  const root = files.makeTemporaryDirectory(
    paths.join({ segments: [files.temporaryRoot(), "inline-exec-layout-"] }),
  );
  installRoots.push(root);
  return root;
};

afterEach(() => {
  installRoots.splice(0).forEach((root) => {
    files.remove(root, { recursive: true, force: true });
  });
});

const decisionFromInstalledCopy = async ({
  command,
}: {
  readonly command: string;
}) => {
  const hookPath = installInlineExecHook({
    harnessDirectory: paths.join({
      segments: [scratchRoot(), "arbitrary", "nesting", ".harness"],
    }),
  });
  const outcome = await invokeBashHook({
    hookFileName: INLINE_EXEC_HOOK,
    hookPath,
    command,
    runtime: "bun",
  });
  return permissionDecisionFrom({ stdout: outcome.stdout }).hookSpecificOutput
    ?.permissionDecision;
};

describe("block-inline-exec reaches the runtime only through sibling ports", () => {
  test("the hook imports no runtime builtin directly", () => {
    expect(hookSource({ hookFileName: INLINE_EXEC_HOOK })).not.toMatch(
      /from\s+"node:/,
    );
  });

  test("every relative import of the hook is a port in the sibling tools directory", () => {
    const relativeImports = relativeImportsOf({
      source: hookSource({ hookFileName: INLINE_EXEC_HOOK }),
    });
    expect(relativeImports.length).toBeGreaterThan(0);
    expect(
      relativeImports.filter((specifier) => !/^\.\.\/tools\/[^/]+$/.test(specifier)),
    ).toStrictEqual([]);
  });

  test("the ports the hook imports have no relative imports of their own", () => {
    const transitive = portsImportedBy({ hookFileName: INLINE_EXEC_HOOK }).flatMap(
      (toolFileName) => relativeImportsOf({ source: toolSource({ toolFileName }) }),
    );
    expect(transitive).toStrictEqual([]);
  });
});

describe("block-inline-exec installed with only its ports at an arbitrary path", () => {
  test("denies an inline eval", async () => {
    expect(await decisionFromInstalledCopy({ command: 'node -e "1"' })).toBe("deny");
  });

  test("passes a plain git command", async () => {
    expect(
      await decisionFromInstalledCopy({ command: "git status --porcelain" }),
    ).toBeUndefined();
  });
});
