import { describe, expect, it, vi } from "vitest";
import type { PackageLocationPort } from "../../../core/platform-ports/package-location-port.ts";
import { defaultParsePort, parsePortOn, TYPESCRIPT_LINES } from "../../../tests/typescript-parse-port.ts";
import { defaultTypeScriptModules, loadParsePort, type TypeScriptModules } from "./typescript-parse.ts";

const INSTALL_ROOT = "/repo/tools/discipline-core";

const typescriptAt = (request: { readonly version: string }): TypeScriptModules => ({
  typescript: () =>
    defaultTypeScriptModules.typescript().then((loaded) => ({ default: { ...loaded.default, version: request.version } })),
});

const locatedAt = (request: { readonly location: string }): PackageLocationPort => ({
  installRoot: INSTALL_ROOT,
  locate: () => request.location,
});

const port = defaultParsePort;
const TWO_STATEMENTS = "const a = 1;\nconst b = 2;\n";

describe("the parse port loaded from the development install's typescript", () => {
  it("parses the given source under the given file name", () => {
    expect(port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS })).toMatchObject({
      fileName: "src/a.ts",
      text: TWO_STATEMENTS,
    });
  });

  it("lists a tree's direct children in source order", () => {
    expect(
      port.children({ node: port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS }) }),
    ).toMatchObject([
      { kind: port.syntaxApi.SyntaxKind.VariableStatement, pos: 0 },
      { kind: port.syntaxApi.SyntaxKind.VariableStatement, pos: 12 },
      { kind: port.syntaxApi.SyntaxKind.EndOfFileToken },
    ]);
  });

  it("points a top-level node's parent at its tree", () => {
    const tree = port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS });

    expect(port.children({ node: tree })[0].parent).toBe(tree);
  });
});

describe("loadParsePort over each supported TypeScript line in the development install", () => {
  it.each(TYPESCRIPT_LINES)("parses with the %s line", async (line) => {
    const linePort = await parsePortOn({ line });
    expect(linePort.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS }).statements).toHaveLength(2);
  });
});

describe("loadParsePort when typescript is missing, unsupported or shadowed", () => {
  it.each(["4.8.3", "7.0.0", "6.1.0-dev.20261101"])("names the installed typescript %s as outside >=4.8.4 <7.0.0", async (version) => {
    await expect(
      loadParsePort({ peers: { location: locatedAt({ location: "/repo/node_modules/typescript/lib/typescript.js" }), modules: typescriptAt({ version }) } }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "typescript", supported: ">=4.8.4 <7.0.0", found: version },
    });
  });

  it("names typescript as shadowed when it resolves from inside the core install, and never loads it", async () => {
    const typescript = vi.fn<TypeScriptModules["typescript"]>();
    await expect(
      loadParsePort({
        peers: { location: locatedAt({ location: `${INSTALL_ROOT}/node_modules/typescript/lib/typescript.js` }), modules: { typescript } },
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "toolchain-shadowed", packageName: "typescript" } });
    expect(typescript).not.toHaveBeenCalled();
  });
});
