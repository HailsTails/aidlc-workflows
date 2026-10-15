import { describe, expect, it, vi } from "vitest";
import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import {
  createFlavouredPathPort,
  type PathPort,
  posixPathFlavour,
  windowsPathFlavour,
} from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { WhyChain } from "../../../core/values/why-chain.ts";
import {
  escapedGlobPath,
  currentProjection,
  type ProjectedPiece,
  pluginImportOf,
  projectionState,
  projectionText,
  writeProjection,
} from "./projection.ts";

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");
const noTmpFiles = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const eslint = mechanismIdSchema.parse("eslint");
const eslint10 = mechanismIdSchema.parse("eslint-10");
const repoRoot = absolutePathSchema.parse("/repo");
const windowsRepoRoot = absolutePathSchema.parse("C:\\repo");
const posixPath = createFlavouredPathPort({ flavour: posixPathFlavour, workingDirectory: () => "/repo" });
const windowsPath = createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: () => "C:\\repo" });

const why = {
  why: "Why does this file declare a class?",
  because: "The vendored parser exports a class the adapter must extend",
  evidence: "vendor/parser/index.d.ts line 12",
};

const whyChain: WhyChain = {
  whys: [why, why, why, why, why],
  rootCause: "The vendored parser's extension point is class-based",
  owner: "260926-vendor-divergence-untrac",
};

const cd14Piece: ProjectedPiece = {
  pluginNamespace: "rin-discipline",
  pluginImport: "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
  clauses: [{ address: classSyntax, ruleId: "rin-discipline/no-class-authoring" }],
};

const probePiece: ProjectedPiece = {
  pluginNamespace: "probe-lint",
  pluginImport: "../team-rules/mechanisms/eslint/PD-1/plugin.ts",
  clauses: [{ address: noTmpFiles, ruleId: "probe-lint/no-tmp-files" }],
};

const authorisedInB: ExceptionRecord = {
  kind: "authorised-location",
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse("src/b.ts"),
  reason: "Structural location for the vendor adapter",
};

const carveOutInA: ExceptionRecord = {
  kind: "file-carve-out",
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse("src/a.ts"),
  reason: "Inherited class awaiting paydown",
  whyChain,
};

const authorisedRoute: ExceptionRecord = {
  kind: "authorised-location",
  clause: noTmpFiles,
  mechanism: eslint,
  file: repoPathSchema.parse("route/[id].ts"),
  reason: "Route file named by the framework",
};

const clauseWideNoTmp: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: noTmpFiles,
  mechanism: eslint,
  reason: "Probe clause carved out while the probe is retired",
  whyChain,
};

const clauseWideClassSyntax: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: classSyntax,
  mechanism: eslint,
  reason: "Class syntax carved out during migration",
  whyChain,
};

const authorisedInBUnderEslint10: ExceptionRecord = { ...authorisedInB, mechanism: eslint10 };

const fullProjection = `import piece0 from "../team-rules/mechanisms/eslint/PD-1/plugin.ts";
import piece1 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/probe-lint",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "probe-lint": piece0 },
    rules: { "probe-lint/no-tmp-files": "error" },
  },
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece1 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
  {
    name: "discipline-core/file-carve-out/CD-14#class-syntax/src/a.ts",
    files: ["src/a.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-14#class-syntax/src/b.ts",
    files: ["src/b.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
  {
    name: "discipline-core/authorised-location/probe/PD-1#no-tmp-files/route/[id].ts",
    files: ["route/\\\\[id\\\\].ts"],
    rules: { "probe-lint/no-tmp-files": "off" },
  },
  {
    name: "discipline-core/clause-wide-carve-out/CD-14#class-syntax",
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
  {
    name: "discipline-core/clause-wide-carve-out/probe/PD-1#no-tmp-files",
    rules: { "probe-lint/no-tmp-files": "off" },
  },
];
`;

const enablingOnlyProjection = `import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
];
`;

const carveOutOnlyProjection = `import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
  {
    name: "discipline-core/file-carve-out/CD-14#class-syntax/src/a.ts",
    files: ["src/a.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
];
`;

const authorisedInBOnlyProjection = `import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
  {
    name: "discipline-core/authorised-location/CD-14#class-syntax/src/b.ts",
    files: ["src/b.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
];
`;

describe("escapedGlobPath", () => {
  it("backslash-escapes each of \\ * ? [ ] { } ( ) ! + @ so the path matches only itself", () => {
    expect(escapedGlobPath({ path: String.raw`a\b*c?d[e]f{g}h(i)j!k+l@m.ts` })).toBe(
      String.raw`a\\b\*c\?d\[e\]f\{g\}h\(i\)j\!k\+l\@m.ts`,
    );
  });

  it("escapes the brackets of route/[id].ts", () => {
    expect(escapedGlobPath({ path: "route/[id].ts" })).toBe(String.raw`route/\[id\].ts`);
  });
});

describe("projectionText", () => {
  it("generates the whole projection: piece blocks, then file blocks by clause text then file, then clause-wide blocks by clause text", () => {
    expect(
      projectionText({
        selectedPieces: [cd14Piece, probePiece],
        records: [
          authorisedInB,
          clauseWideNoTmp,
          carveOutInA,
          authorisedRoute,
          clauseWideClassSyntax,
        ],
      }),
    ).toBe(fullProjection);
  });

  it("generates the same text whatever order the pieces and records arrive in", () => {
    expect(
      projectionText({
        selectedPieces: [probePiece, cd14Piece],
        records: [
          clauseWideClassSyntax,
          authorisedRoute,
          carveOutInA,
          clauseWideNoTmp,
          authorisedInB,
        ],
      }),
    ).toBe(fullProjection);
  });

  it("holds only the enabling block when there are no records", () => {
    expect(projectionText({ selectedPieces: [cd14Piece], records: [] })).toBe(
      enablingOnlyProjection,
    );
  });

  it("emits a file carve-out block whether or not the carve-out is forfeited, since the projection takes no touched set", () => {
    expect(projectionText({ selectedPieces: [cd14Piece], records: [carveOutInA] })).toBe(
      carveOutOnlyProjection,
    );
  });

  it("emits the off block of a record carrying whatever mechanism id the runner is registered under", () => {
    expect(projectionText({ selectedPieces: [cd14Piece], records: [authorisedInBUnderEslint10] })).toBe(
      authorisedInBOnlyProjection,
    );
  });

  it("orders files by code unit, so src/B.ts precedes src/a.ts", () => {
    expect(
      projectionText({
        selectedPieces: [cd14Piece],
        records: [carveOutInA, { ...authorisedInB, file: repoPathSchema.parse("src/B.ts") }],
      }),
    ).toBe(`import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
  {
    name: "discipline-core/authorised-location/CD-14#class-syntax/src/B.ts",
    files: ["src/B.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
  {
    name: "discipline-core/file-carve-out/CD-14#class-syntax/src/a.ts",
    files: ["src/a.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
];
`);
  });
});

describe("pluginImportOf", () => {
  it("joins the piece root and plugin module and makes the result relative to the repo root", () => {
    const join = vi.fn().mockReturnValue("/repo/node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts");
    const relative = vi.fn().mockReturnValue({
      relation: "within-root",
      path: "node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
    const path: PathPort = {
      join,
      joinRepository: vi.fn(),
      relative,
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    };

    pluginImportOf({
      path,
      repoRoot,
      pieceRoot: "/repo/node_modules/dc/mechanisms/eslint/CD-14",
      pluginModule: "cd14/cd14.eslint-plugin.ts",
    });

    expect(join).toHaveBeenCalledWith({
      segments: ["/repo/node_modules/dc/mechanisms/eslint/CD-14", "cd14/cd14.eslint-plugin.ts"],
    });
    expect(relative).toHaveBeenCalledWith({
      from: "/repo",
      to: "/repo/node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
  });

  it("prefixes ./ to a module inside the repository", () => {
    const path: PathPort = {
      join: vi.fn().mockReturnValue("/repo/node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts"),
      joinRepository: vi.fn(),
      relative: vi.fn().mockReturnValue({
        relation: "within-root",
        path: "node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
      }),
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    };

    expect(
      pluginImportOf({
        path,
        repoRoot,
        pieceRoot: "/repo/node_modules/dc/mechanisms/eslint/CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "./node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
  });

  it("keeps a module outside the repository as its ../ path", () => {
    const path: PathPort = {
      join: vi.fn().mockReturnValue("/team-rules/mechanisms/eslint/PD-1/plugin.ts"),
      joinRepository: vi.fn(),
      relative: vi.fn().mockReturnValue({ relation: "within-root", path: "../team-rules/mechanisms/eslint/PD-1/plugin.ts" }),
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    };

    expect(
      pluginImportOf({
        path,
        repoRoot,
        pieceRoot: "/team-rules/mechanisms/eslint/PD-1",
        pluginModule: "plugin.ts",
      }),
    ).toEqual({ placement: "importable", specifier: "../team-rules/mechanisms/eslint/PD-1/plugin.ts" });
  });

  it("imports a Windows piece inside the repository by a ./ specifier in forward slashes", () => {
    expect(
      pluginImportOf({
        path: windowsPath,
        repoRoot: windowsRepoRoot,
        pieceRoot: "C:\\repo\\tools\\discipline\\mechanisms\\eslint\\CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "./tools/discipline/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
  });

  it("imports a Windows install outside the repository on the same drive by a ../ specifier in forward slashes", () => {
    expect(
      pluginImportOf({
        path: windowsPath,
        repoRoot: windowsRepoRoot,
        pieceRoot: "C:\\installs\\dc\\mechanisms\\eslint\\CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "../installs/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
  });

  it("reports a piece on another drive from the repository as piece-on-another-root", () => {
    expect(
      pluginImportOf({
        path: windowsPath,
        repoRoot: windowsRepoRoot,
        pieceRoot: "D:\\dc\\mechanisms\\eslint\\CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toEqual({ placement: "piece-on-another-root" });
  });

  it("reports a piece on a network share from a repository on a drive as piece-on-another-root", () => {
    expect(
      pluginImportOf({
        path: windowsPath,
        repoRoot: windowsRepoRoot,
        pieceRoot: "\\\\server\\share\\dc\\mechanisms\\eslint\\CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toEqual({ placement: "piece-on-another-root" });
  });
});


describe("projectionState", () => {
  it("is missing when there is no projection file", () => {
    expect(
      projectionState({ current: { presence: "absent" }, generated: enablingOnlyProjection }),
    ).toBe("missing");
  });

  it("is current when the file's bytes equal the generation", () => {
    expect(
      projectionState({
        current: { presence: "present", text: enablingOnlyProjection },
        generated: enablingOnlyProjection,
      }),
    ).toBe("current");
  });

  it("is out-of-date when the file differs only by its trailing newline", () => {
    expect(
      projectionState({
        current: { presence: "present", text: "export default [];" },
        generated: "export default [];\n",
      }),
    ).toBe("out-of-date");
  });

  it("is out-of-date when the file is hand-edited", () => {
    expect(
      projectionState({
        current: { presence: "present", text: "export default [];\n" },
        generated: enablingOnlyProjection,
      }),
    ).toBe("out-of-date");
  });
});

describe("currentProjection", () => {
  it("reads a projection with CRLF line endings as the same text with LF line endings", () => {
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: "export default [\r\n];\r\n" }),
      exists: vi.fn().mockReturnValue("present"),
      write: vi.fn(),
    };

    expect(currentProjection({ fileText, path: posixPath, repoRoot })).toEqual({
      outcome: "ok",
      value: { presence: "present", text: "export default [\n];\n" },
    });
  });
});

describe("writeProjection", () => {
  it("leaves a projection that differs only by CRLF line endings alone, and reports it unchanged", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: "export default [\r\n];\r\n" }),
      exists: vi.fn().mockReturnValue("present"),
      write,
    };

    expect({
      result: writeProjection({ fileText, path: posixPath, repoRoot, text: "export default [\n];\n" }),
      writes: write.mock.calls,
    }).toEqual({
      result: { outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "unchanged" } },
      writes: [],
    });
  });

  it("rewrites a CRLF projection that also differs in content, writing LF line endings", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: "export default [\r\n  1,\r\n];\r\n" }),
      exists: vi.fn().mockReturnValue("present"),
      write,
    };

    expect({
      result: writeProjection({ fileText, path: posixPath, repoRoot, text: "export default [\n];\n" }),
      writes: write.mock.calls,
    }).toEqual({
      result: { outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } },
      writes: [[{ path: "/repo/disciplines.eslint.mjs", text: "export default [\n];\n" }]],
    });
  });

  it("writes disciplines.eslint.mjs at the repo root when no projection exists, and reports it written", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn(),
      exists: vi.fn().mockReturnValue("absent"),
      write,
    };

    expect(writeProjection({ fileText, path: posixPath, repoRoot, text: enablingOnlyProjection })).toEqual({
      outcome: "ok",
      value: { path: "disciplines.eslint.mjs", effect: "written" },
    });
    expect(write).toHaveBeenCalledWith({
      path: "/repo/disciplines.eslint.mjs",
      text: enablingOnlyProjection,
    });
  });

  it("rewrites a projection whose bytes differ, and reports it written", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: "export default [];\n" }),
      exists: vi.fn().mockReturnValue("present"),
      write,
    };

    expect(writeProjection({ fileText, path: posixPath, repoRoot, text: enablingOnlyProjection })).toEqual({
      outcome: "ok",
      value: { path: "disciplines.eslint.mjs", effect: "written" },
    });
    expect(write).toHaveBeenCalledWith({
      path: "/repo/disciplines.eslint.mjs",
      text: enablingOnlyProjection,
    });
  });

  it("leaves a byte-identical projection alone, and reports it unchanged", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: enablingOnlyProjection }),
      exists: vi.fn().mockReturnValue("present"),
      write,
    };

    expect(writeProjection({ fileText, path: posixPath, repoRoot, text: enablingOnlyProjection })).toEqual({
      outcome: "ok",
      value: { path: "disciplines.eslint.mjs", effect: "unchanged" },
    });
    expect(write).not.toHaveBeenCalled();
  });

  it("reports an existing projection it cannot read as file-unreadable", () => {
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({
        outcome: "failed",
        error: { kind: "unreadable", path: "/repo/disciplines.eslint.mjs", detail: "EACCES" },
      }),
      exists: vi.fn().mockReturnValue("present"),
      write: vi.fn(),
    };

    expect(writeProjection({ fileText, path: posixPath, repoRoot, text: enablingOnlyProjection })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "disciplines.eslint.mjs", detail: "EACCES" },
    });
  });

  it("reports a projection it cannot write as tool-failed carrying the port's detail", () => {
    const fileText: FileTextPort = {
      read: vi.fn(),
      exists: vi.fn().mockReturnValue("absent"),
      write: vi.fn().mockReturnValue({
        outcome: "failed",
        error: { kind: "unwritable", path: "/repo/disciplines.eslint.mjs", detail: "EROFS" },
      }),
    };

    expect(writeProjection({ fileText, path: posixPath, repoRoot, text: enablingOnlyProjection })).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "EROFS" },
    });
  });
});

describe("projection file location on Windows", () => {
  it("asks the file port whether the projection exists, and reads it, at its Windows form under the repo root", () => {
    const exists = vi.fn().mockReturnValue("present");
    const read = vi.fn().mockReturnValue({ outcome: "ok", value: enablingOnlyProjection });
    const fileText: FileTextPort = { read, exists, write: vi.fn() };

    currentProjection({ fileText, path: windowsPath, repoRoot: windowsRepoRoot });

    expect({ exists: exists.mock.calls, read: read.mock.calls }).toEqual({
      exists: [[{ path: "C:\\repo\\disciplines.eslint.mjs" }]],
      read: [[{ path: "C:\\repo\\disciplines.eslint.mjs" }]],
    });
  });

  it("writes the projection at its Windows form under the repo root", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = { read: vi.fn(), exists: vi.fn().mockReturnValue("absent"), write };

    writeProjection({ fileText, path: windowsPath, repoRoot: windowsRepoRoot, text: enablingOnlyProjection });

    expect(write.mock.calls).toEqual([[{ path: "C:\\repo\\disciplines.eslint.mjs", text: enablingOnlyProjection }]]);
  });
});
