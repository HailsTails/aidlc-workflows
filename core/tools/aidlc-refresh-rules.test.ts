import { Buffer } from "node:buffer";
import { expect, test } from "bun:test";
import { captureRefreshRuleInputs, prepareRefreshRuleInputs, type RefreshRuleFilesystem } from "./aidlc-refresh-rules.ts";

const memory = "aidlc/spaces/default/memory";
const fixture = () => {
  const files = new Map<string, Buffer>([
    ["/project/" + memory + "/org.md", Buffer.from("# Private org\r\n")],
    ["/project/" + memory + "/team.md", Buffer.from("# Private team\n")],
    ["/staged/" + memory + "/org.md", Buffer.from("# Release org\n")],
    ["/staged/" + memory + "/team.md", Buffer.from("# Release team\n")],
    ["/staged/" + memory + "/project.md", Buffer.from("# Release project\n")],
  ]);
  const unreadableRoots = new Set<string>();
  const writes: string[] = [];
  const removals: string[] = [];
  const filesystem: RefreshRuleFilesystem = {
    read: ({ root }) => {
      if (unreadableRoots.has(root)) throw new Error("fake reader unavailable");
      return [...files].filter(([path]) => path.startsWith(root + "/"))
        .map(([path, bytes]) => ({ path: path.slice(root.length + 1), bytes: Buffer.from(bytes) }));
    },
    write: ({ root, path, bytes }) => {
      writes.push(root + "/" + path);
      files.set(root + "/" + path, Buffer.from(bytes));
    },
    remove: ({ root, path }) => {
      removals.push(root + "/" + path);
      files.delete(root + "/" + path);
    },
    digest: ({ bytes }) => "fake:" + bytes.toString("utf8"),
  };
  return {
    args: { projectDir: "/project", stagedRoot: "/staged", filesystem },
    writes, removals,
    text: (args: { readonly root: string; readonly path: string }) => files.get(args.root + "/" + args.path)?.toString("utf8"),
    set: (args: { readonly root: string; readonly path: string; readonly text: string }) => { files.set(args.root + "/" + args.path, Buffer.from(args.text)); },
    remove: (args: { readonly root: string; readonly path: string }) => { files.delete(args.root + "/" + args.path); },
    refuseReads: (args: { readonly root: string }) => { unreadableRoots.add(args.root); },
  };
};

test("read-only preparation stages only retained rule bytes using its own controlled filesystem", () => {
  const f = fixture();
  const prepared = prepareRefreshRuleInputs({ ...f.args, workspaceMode: "read-only" });
  expect(f.text({ root: "/staged", path: "aidlc/spaces/default/memory/org.md" })).toBe("# Private org\r\n");
  expect(f.text({ root: "/staged", path: "aidlc/spaces/default/memory/team.md" })).toBe("# Private team\n");
  expect(f.text({ root: "/staged", path: "aidlc/spaces/default/memory/project.md" })).toBeUndefined();
  expect(f.removals).toEqual(["/staged/aidlc/spaces/default/memory/project.md"]);
  expect(f.writes).toEqual([
    "/staged/aidlc/spaces/default/memory/org.md", "/staged/aidlc/spaces/default/memory/team.md",
  ]);
  expect(prepared.evidence).toEqual({
    "aidlc/spaces/default/memory/org.md": "fake:# Private org\r\n",
    "aidlc/spaces/default/memory/team.md": "fake:# Private team\n",
  });
});
test("normal preparation leaves forthcoming release seeds and retains live bytes", () => {
  const f = fixture();
  prepareRefreshRuleInputs({ ...f.args, workspaceMode: "seed" });
  expect(f.text({ root: "/staged", path: "aidlc/spaces/default/memory/project.md" })).toBe("# Release project\n");
  expect(f.text({ root: "/staged", path: "aidlc/spaces/default/memory/team.md" })).toBe("# Private team\n");
  expect(f.removals).toEqual([]);
});
test("evidence captured before staging remains bound to the original byte snapshot", () => {
  const f = fixture();
  const prepared = prepareRefreshRuleInputs({ ...f.args, workspaceMode: "read-only" });
  f.set({ root: "/project", path: "aidlc/spaces/default/memory/team.md", text: "# Edited after preparation\n" });
  expect(prepared.evidence).toEqual({
    "aidlc/spaces/default/memory/org.md": "fake:# Private org\r\n",
    "aidlc/spaces/default/memory/team.md": "fake:# Private team\n",
  });
  expect(prepared.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
  expect(f.text({ root: "/staged", path: "aidlc/spaces/default/memory/team.md" })).toBe("# Private team\n");
});
test("locked validation accepts the exact retained dependency snapshot", () => {
  const f = fixture();
  const prepared = prepareRefreshRuleInputs({ ...f.args, workspaceMode: "read-only" });
  expect(prepared.validateLocked()).toEqual({ kind: "validated" });
});
test("locked validation rejects newly present rule inputs", () => {
  const f = fixture();
  const prepared = prepareRefreshRuleInputs({ ...f.args, workspaceMode: "read-only" });
  f.set({ root: "/project", path: "aidlc/spaces/default/memory/project.md", text: "# Added private project\n" });
  expect(prepared.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
});
test("locked validation rejects removed rule inputs", () => {
  const f = fixture();
  const prepared = prepareRefreshRuleInputs({ ...f.args, workspaceMode: "read-only" });
  f.remove({ root: "/project", path: "aidlc/spaces/default/memory/team.md" });
  expect(prepared.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
});
test("locked read errors are operational refusals", () => {
  const f = fixture();
  const prepared = prepareRefreshRuleInputs({ ...f.args, workspaceMode: "read-only" });
  f.refuseReads({ root: "/project" });
  expect(prepared.validateLocked()).toEqual({
    kind: "refused", reason: "inputs-changed",
    message: "refresh rule authoring inputs became unreadable after preparation; plan again",
  });
});
test("failed initial reads cannot create a prepared projection", () => {
  const f = fixture();
  f.refuseReads({ root: "/project" });
  expect(() => prepareRefreshRuleInputs({ ...f.args, workspaceMode: "read-only" })).toThrow("fake reader unavailable");
  expect(f.writes).toEqual([]);
  expect(f.removals).toEqual([]);
});
test("retained authoring remains unchanged when the projection is prepared", () => {
  const f = fixture();
  prepareRefreshRuleInputs({ ...f.args, workspaceMode: "read-only" });
  expect(f.text({ root: "/project", path: "aidlc/spaces/default/memory/org.md" })).toBe("# Private org\r\n");
  expect(f.text({ root: "/project", path: "aidlc/spaces/default/memory/team.md" })).toBe("# Private team\n");
});

test("capturing empty first-install membership never writes the source and catches a later rule", () => {
  const f = fixture();
  f.remove({ root: "/project", path: "aidlc/spaces/default/memory/org.md" });
  f.remove({ root: "/project", path: "aidlc/spaces/default/memory/team.md" });
  const captured = captureRefreshRuleInputs(f.args);
  expect(captured.evidence).toEqual({});
  expect(captured.validateLocked()).toEqual({ kind: "validated" });
  f.set({ root: "/project", path: "aidlc/spaces/default/memory/team.md", text: "# Added during first install\n" });
  expect(captured.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
  expect(f.writes).toEqual([]);
  expect(f.removals).toEqual([]);
});
