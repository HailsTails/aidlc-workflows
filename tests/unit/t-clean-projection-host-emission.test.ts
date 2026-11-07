import { describe, expect, test } from "bun:test";
import { manifestEmitter } from "../../scripts/projection/src/adapters/manifest-capabilities.ts";
import { hostRootChanges, admitPreparedHostRoot, type DistributionRoot } from "../../scripts/projection/src/domain/prepared-host-root.ts";
import { applyPreparedHostRoot } from "../../scripts/projection/src/application/host-distribution-preparation.ts";
import type { ProjectionDistributionRequest } from "../../scripts/projection/src/application/projection-distribution-request.ts";
import { completeProjectionDistribution, type IssuedProjectionDistribution } from "../../scripts/projection/examples/projection-distribution.ts";
import { selectHarnessDocumentProducts } from "../../scripts/projection/examples/harness-document-products.ts";
import { qualifiedHarnessProfile } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { nativeDocumentCommandSourcePaths } from "../../scripts/projection/src/adapters/native-document-commands.ts";
import { issueCoreProjectionOwnership } from "../../scripts/projection/src/domain/projection-ownership.ts";
import { createOwnershipDigest } from "../../scripts/projection/src/adapters/projection-ownership.ts";
import { prepareNativeHistory } from "../../scripts/projection/native/native-delivery.ts";
import { verifyIssuedCorePair } from "../../scripts/projection/src/adapters/fresh-core-assembly.ts";
import { assembleFreshCoreSession } from "../../scripts/projection/src/adapters/fresh-core-assembly.ts";
import { projectCorePublicationSession } from "../../scripts/project-core.ts";
import { createHash } from "node:crypto";

const binding = { harness: "claude", directory: ".claude" } as const;
const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const origin = { ...basis, path: "harness/claude/manifest.ts" };
const file = (path: string, bytes: readonly number[] = [1], mode = 0o666) => ({ path, bytes: Uint8Array.from(bytes), mode });
const before: DistributionRoot = { files: [file("tree/old"), file("tree/removed")], directories: [{ path: "tree", mode: 0o755 }] };
const after: DistributionRoot = { files: [file("tree/old", [0, 255], 0o444), file("new/binary", [255, 0, 128])], directories: [{ path: "tree", mode: 0o755 }, { path: "new", mode: 0o700 }, { path: "empty", mode: 0o755 }] };
const preparation = () => ({ ...after, ...hostRootChanges(before, after), inputs: [{ path: origin.path, sha256: "b".repeat(64) }] });
const request = (): ProjectionDistributionRequest => ({ sourceRoot: "/source", seed: { basis, binding, rulesSubdir: "rules", invocation: "aidlc", ...before, preparationStage: "before-host" }, projection: { scope: "selected-surfaces", target: binding, units: [], resources: [] }, mode: 0o666 });

describe("source emitter capability admission", () => {
  test("only emit is callable, with ordinary manifest data retained", () => {
    const emit = () => "ignored return";
    expect(manifestEmitter({ name: "claude", emit })).toBe(emit);
    expect(manifestEmitter({ emit: null })).toBeNull();
    expect(manifestEmitter({ emit: undefined })).toBeNull();
    expect(manifestEmitter({ name: "claude" })).toBeNull();
    expect(() => manifestEmitter({ ordinary: undefined })).toThrow();
    expect(() => manifestEmitter({ extra: emit })).toThrow();
  });
  test("does not invoke accessors, proxies or custom serialization", () => {
    let touched = false;
    expect(() => manifestEmitter({ get emit() { touched = true; return () => {}; } })).toThrow();
    expect(touched).toBe(false);
    expect(() => manifestEmitter(new Proxy({ emit: () => {} }, {}))).toThrow();
    expect(() => manifestEmitter({ emit: new Proxy(() => {}, {}), toJSON: () => ({}) })).toThrow();
  });
});

test("source sessions refuse an empty plan before source execution", async () => {
  await expect(assembleFreshCoreSession({ request: { sourceRoot: "unused", outRoot: "unused", buildVersion: "1.0.0", environmentCap: null }, steps: [], workRoot: "unused" })).rejects.toThrow();
});
test.skipIf(process.platform !== "win32")("publication roots refuse Windows case aliases and nested aliases before execution", async () => {
  for (const nativeRoot of ["c:/session/output", "c:/session/output/child"]) await expect(projectCorePublicationSession({ sourceRoot: "unused", outRoot: "unused", buildVersion: "1.0.0", environmentCap: null }, [{ binding, copyRoot: "C:/Session/Output", nativeRoot }])).rejects.toThrow("distinct non-overlapping");
});

describe("prepared root amendment", () => {
  test("records binary additions, replacements, removals and empty directories", () => {
    const prepared = preparation();
    expect(prepared.added).toEqual(["new/binary"]);
    expect(prepared.replaced).toEqual(["tree/old"]);
    expect(prepared.removed).toEqual(["tree/removed"]);
    expect(prepared.directoriesAdded).toEqual(["empty", "new"]);
    expect(admitPreparedHostRoot(before, prepared).status).toBe("ok");
  });
  test("rejects invented deltas, unsafe paths, aliases and missing parents", () => {
    const prepared = preparation();
    for (const bad of [
      { ...prepared, removed: [] },
      { ...prepared, files: [...prepared.files, file("../escape")] },
      { ...prepared, files: [...prepared.files, file("TREE/old")] },
      { ...prepared, directories: prepared.directories.filter(directory => directory.path !== "new") },
      { ...prepared, directoriesChanged: ["tree"] },
    ]) expect(admitPreparedHostRoot(before, bad).status).toBe("invalid");
  });
  test("successful finalization consumes the unfinished stage and retains its exact evidence", () => {
    const diagnostics = { stdout: "callback log\n", stderr: "callback warning\n" };
    const result = applyPreparedHostRoot({ request: request(), before, prepared: { ...preparation(), diagnostics }, origin });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.value.seed.preparationStage).toBeUndefined();
    expect(result.value.preparedProducts?.[0]?.files[0]?.bytes).toEqual(Uint8Array.from([0, 255]));
    const evidence = result.value.seed.inputPreparations?.[0];
    expect(evidence?.kind).toBe("host-emission");
    if (evidence?.kind === "host-emission") {
      expect(evidence.changes.removed).toEqual(["tree/removed"]);
      expect(evidence.diagnostics).toEqual(diagnostics);
      expect(Object.keys(evidence.changes)).not.toContain("diagnostics");
    }
  });
  test("a no-op or omitted finalizer cannot issue the unfinished native stage", async () => {
    const result = await completeProjectionDistribution(request());
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") expect(result.findings[0]?.subject).toBe("host-finalization");
  });
});

describe("phase-specific authoring provenance", () => {
  const documents = (native: boolean) => ({ inputs: [], documents: qualifiedHarnessProfile(binding)!.entryDocuments.map(placement => ({ authored: { role: placement.role, origin: { ...basis, path: `harness/claude/${placement.source}` }, text: "body" }, destination: placement.destination, binding, text: "body", authoring: [origin, { ...basis, path: "scripts/earlier-release-regions.ts" }, ...(native ? nativeDocumentCommandSourcePaths().map(path => ({ ...basis, path })) : [])] })) });
  test("before-host requires exactly the source policy actually evaluated", () => {
    expect(selectHarnessDocumentProducts({ sources: documents(false), basis, context: { ...binding, invocation: "aidlc", preparationStage: "before-host" } }).status).toBe("ok");
    expect(selectHarnessDocumentProducts({ sources: documents(true), basis, context: { ...binding, invocation: "aidlc", preparationStage: "before-host" } }).status).toBe("invalid");
  });
  test("completed native rendering still requires every native command source", () => {
    expect(selectHarnessDocumentProducts({ sources: documents(false), basis, context: { ...binding, invocation: "aidlc" } }).status).toBe("invalid");
    expect(selectHarnessDocumentProducts({ sources: documents(true), basis, context: { ...binding, invocation: "aidlc" } }).status).toBe("ok");
  });
  test("missing, duplicate and foreign origins remain invalid before the host", () => {
    for (const authoring of [[], [origin, origin], [origin, { ...basis, pin: "c".repeat(40), path: "scripts/earlier-release-regions.ts" }]]) {
      const sources = documents(false);
      sources.documents[0]!.authoring = authoring;
      expect(selectHarnessDocumentProducts({ sources, basis, context: { ...binding, invocation: "aidlc", preparationStage: "before-host" } }).status).toBe("invalid");
    }
  });
});

describe("prepared product ownership", () => {
  const issue = (path: string, actualBytes = [0, 255]) => {
    const product = { key: "manifest-emission", owner: basis, binding, inputs: [origin], requiredByProducer: [], files: [file(path, [0, 255], 0o444)] };
    return issueCoreProjectionOwnership({ distribution: { seed: basis, binding, files: [file(path, actualBytes, 0o444)], directories: [], replaced: [path], retained: [] }, products: [], preparedProducts: [product], digest: createOwnershipDigest() });
  };
  test("ordinary emitted data retains binary bytes and its observed mode", () => expect(issue(".claude/tools/data/extension.bin").status).toBe("ok"));
  test("cannot claim finalizer metadata or mismatched final bytes", () => {
    for (const path of [".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/root-blocks/agents"]) expect(issue(path).status).toBe("invalid");
    expect(issue(".claude/tools/data/extension.bin", [0, 254]).status).toBe("invalid");
  });
});

describe("issued copy/native pair binding", () => {
  test("a different same-source copy cannot supply migration history", () => {
    const descriptorPath = ".claude/tools/data/aidlc-projection.json";
    const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
    const copyFiles = [{ path: descriptorPath, bytes: encode({ managedDirectories: ["extra"] }), mode: 0o666 }, file("extra/variant.md", [1])];
    const nativeFiles = [{ path: descriptorPath, bytes: encode({ managedDirectories: ["extra"] }), mode: 0o666 }, file("extra/variant.md", [2])];
    const history = prepareNativeHistory({ nativeFiles, copyFiles: copyFiles.map(file => ({ path: file.path, sha256: `sha256:${createHash("sha256").update(file.bytes).digest("hex")}` })), history: {}, harnessDir: ".claude", managedDirectories: ["extra"] });
    expect(history.kind).toBe("prepared");
    if (history.kind !== "prepared") return;
    nativeFiles[0]!.bytes = encode({ managedDirectories: ["extra"], retiredCopyFileHashes: history.retiredCopyFileHashes, legacyManagedFileHashes: history.legacyManagedFileHashes });
    const artifact = (delivery: "copy" | "native", files: typeof copyFiles): IssuedProjectionDistribution => ({ evaluation: { delivery, buildVersion: "1.0.0", environmentCap: null }, archive: new Uint8Array(), ownershipJson: "", distribution: { seed: basis, binding, files, directories: [], replaced: [], retained: [] }, projection: { scope: "selected-surfaces", target: binding, units: [], resources: [] } });
    const copy = artifact("copy", copyFiles), native = artifact("native", nativeFiles);
    expect(() => verifyIssuedCorePair(copy, native, {})).not.toThrow();
    nativeFiles[0]!.bytes = encode({ managedDirectories: ["extra"], retiredCopyFileHashes: history.retiredCopyFileHashes, legacyManagedFileHashes: Object.fromEntries(Object.entries(history.legacyManagedFileHashes).reverse()) });
    expect(() => verifyIssuedCorePair(copy, native, {})).not.toThrow();
    const swapped = artifact("copy", [copyFiles[0]!, file("extra/variant.md", [3])]);
    expect(() => verifyIssuedCorePair(swapped, native, {})).toThrow("actual paired copy");
    expect(() => verifyIssuedCorePair({ ...copy, evaluation: { ...copy.evaluation!, buildVersion: "2.0.0" } }, native, {})).toThrow("same source");
  });
});
