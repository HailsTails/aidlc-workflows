import { describe, expect, test } from "vitest";
import {
  applyBinding,
  BINDINGS,
  type ConfigRunner,
  type DriverBinding,
  type GitConfigResult,
} from "./rin-gates-merge-drivers";

const bindingNamed = (name: string): DriverBinding => {
  const found = BINDINGS.find((binding) => binding.name === name);
  if (found === undefined) throw new Error(`no binding named ${name}`);
  return found;
};

const runnerReturning = (
  results: readonly GitConfigResult[],
): { readonly run: ConfigRunner; readonly calls: string[][] } => {
  const calls: string[][] = [];
  const run: ConfigRunner = (args) => {
    calls.push([...args]);
    return results[calls.length - 1] ?? { ok: true, out: "" };
  };
  return { run, calls };
};

describe("BINDINGS", () => {
  test("binds the audit shard with git's ours and theirs placeholders", () => {
    expect(bindingNamed("rin-audit-shard").command).toBe(
      "pnpm -s rin-gates:shard-merge --path %P --ours %A --theirs %B --out %A",
    );
  });

  test("binds the registry with the ancestor placeholder git supplies", () => {
    expect(bindingNamed("rin-intents-registry").command).toBe(
      "pnpm -s rin-gates:registry-merge --base %O --ours %A --theirs %B --out %A",
    );
  });

  test("every binding writes its result back to the ours file git reads", () => {
    BINDINGS.forEach((binding) => {
      expect(binding.command).toContain("--out %A");
    });
  });

  test("names both drivers the gitattributes file references", () => {
    expect(BINDINGS.map((binding) => binding.name)).toEqual([
      "rin-audit-shard",
      "rin-intents-registry",
    ]);
  });
});

describe("applyBinding", () => {
  test("reports unchanged and writes nothing when the command already matches", () => {
    const binding = bindingNamed("rin-intents-registry");
    const { run, calls } = runnerReturning([
      { ok: true, out: binding.command },
    ]);
    expect(applyBinding({ binding, runConfig: run })).toBe("unchanged");
    expect(calls).toEqual([["--get", "merge.rin-intents-registry.driver"]]);
  });

  test("writes both the name and the driver when the config is absent", () => {
    const binding = bindingNamed("rin-audit-shard");
    const { run, calls } = runnerReturning([{ ok: false, out: "" }]);
    expect(applyBinding({ binding, runConfig: run })).toBe("configured");
    expect(calls[1]).toEqual(["merge.rin-audit-shard.name", binding.describes]);
    expect(calls[2]).toEqual(["merge.rin-audit-shard.driver", binding.command]);
  });

  test("rewrites when an existing command differs from the current binding", () => {
    const binding = bindingNamed("rin-audit-shard");
    const { run, calls } = runnerReturning([
      { ok: true, out: "stale --command" },
    ]);
    expect(applyBinding({ binding, runConfig: run })).toBe("configured");
    expect(calls).toHaveLength(3);
  });

  test("reports write-failed rather than success when the driver write fails", () => {
    const binding = bindingNamed("rin-audit-shard");
    const { run } = runnerReturning([
      { ok: false, out: "" },
      { ok: true, out: "" },
      { ok: false, out: "" },
    ]);
    expect(applyBinding({ binding, runConfig: run })).toBe("write-failed");
  });

  test("reports write-failed when the descriptive name write fails", () => {
    const binding = bindingNamed("rin-audit-shard");
    const { run } = runnerReturning([
      { ok: false, out: "" },
      { ok: false, out: "" },
      { ok: true, out: "" },
    ]);
    expect(applyBinding({ binding, runConfig: run })).toBe("write-failed");
  });
});
