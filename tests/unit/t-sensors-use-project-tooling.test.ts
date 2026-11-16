// covers: tool:aidlc-project-tool, tool:aidlc-sensor-linter, tool:aidlc-sensor-type-check
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	missingProjectToolMessage,
	projectToolCommand,
	resolveProjectTool,
	type ProjectTool,
	type ProjectToolRequest,
} from "../../core/tools/aidlc-project-tool.ts";
import { selectInstalledEslint } from "../../core/tools/aidlc-sensor-linter.ts";
import { selectInstalledTsc } from "../../core/tools/aidlc-sensor-type-check.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const createdRoots: string[] = [];

afterAll(() => {
	for (const root of createdRoots) rmSync(root, { recursive: true, force: true });
});

function temporaryProject(): string {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "aidlc-project-tool-")));
	createdRoots.push(root);
	writeFileSync(join(root, "package.json"), '{"private":true}\n');
	return root;
}

function installPackage(input: {
	directory: string;
	name: string;
	version: string;
	bin: string | Record<string, string>;
	binFile: string;
}): string {
	const packageDirectory = join(input.directory, "node_modules", input.name);
	mkdirSync(join(packageDirectory, "bin"), { recursive: true });
	writeFileSync(join(packageDirectory, "package.json"),
		JSON.stringify({ name: input.name, version: input.version, bin: input.bin }));
	const cliPath = join(packageDirectory, input.binFile);
	writeFileSync(cliPath, "export {};\n");
	return cliPath;
}

function fixedResolver(tool: ProjectTool | null): (request: ProjectToolRequest) => ProjectTool | null {
	return () => tool;
}

const eslintAt = (version: string): ProjectTool => ({
	packageName: "eslint", version, cliPath: "/repo/node_modules/eslint/bin/eslint.js",
});

describe("resolveProjectTool reads the project's own dependency tree", () => {
	test("finds the named bin of a package installed beside the project", () => {
		const project = temporaryProject();
		const cliPath = installPackage({ directory: project, name: "eslint", version: "9.39.5",
			bin: { eslint: "./bin/eslint.js" }, binFile: "bin/eslint.js" });
		expect(resolveProjectTool({ projectRoot: project, packageName: "eslint", binName: "eslint" }))
			.toEqual({ packageName: "eslint", version: "9.39.5", cliPath });
	});

	test("finds a hoisted install in an ancestor workspace", () => {
		const workspace = temporaryProject();
		const member = join(workspace, "packages", "member");
		mkdirSync(member, { recursive: true });
		const cliPath = installPackage({ directory: workspace, name: "typescript", version: "5.9.3",
			bin: { tsc: "./bin/tsc", tsserver: "./bin/tsserver" }, binFile: "bin/tsc" });
		expect(resolveProjectTool({ projectRoot: member, packageName: "typescript", binName: "tsc" })?.cliPath)
			.toBe(cliPath);
	});

	test("accepts a single string bin", () => {
		const project = temporaryProject();
		const cliPath = installPackage({ directory: project, name: "@biomejs/biome", version: "2.4.16",
			bin: "bin/biome", binFile: "bin/biome" });
		expect(resolveProjectTool({ projectRoot: project, packageName: "@biomejs/biome", binName: "biome" })?.cliPath)
			.toBe(cliPath);
	});

	test("reports nothing when the project has not installed the package", () => {
		expect(resolveProjectTool({ projectRoot: temporaryProject(), packageName: "eslint", binName: "eslint" }))
			.toBeNull();
	});

	test("the nearest install decides, as Node resolution does", () => {
		const workspace = temporaryProject();
		installPackage({ directory: workspace, name: "eslint", version: "10.11.0",
			bin: { eslint: "./bin/eslint.js" }, binFile: "bin/eslint.js" });
		const member = join(workspace, "member");
		mkdirSync(join(member, "node_modules", "eslint"), { recursive: true });
		writeFileSync(join(member, "node_modules", "eslint", "package.json"), JSON.stringify({ name: "eslint", version: "9.0.0" }));
		expect(resolveProjectTool({ projectRoot: member, packageName: "eslint", binName: "eslint" })).toBeNull();
	});

	test("a package directory holding a different package is not adopted", () => {
		const project = temporaryProject();
		installPackage({ directory: project, name: "eslint", version: "1.0.0",
			bin: { eslint: "./bin/eslint.js" }, binFile: "bin/eslint.js" });
		writeFileSync(join(project, "node_modules", "eslint", "package.json"),
			JSON.stringify({ name: "not-eslint", version: "1.0.0", bin: { eslint: "./bin/eslint.js" } }));
		expect(resolveProjectTool({ projectRoot: project, packageName: "eslint", binName: "eslint" })).toBeNull();
	});

	test.each([["eslint", "eslint"], ["typescript", "tsc"]])(
		"a %s executable named %s on PATH is never adopted",
		(packageName, binName) => {
			const workspace = temporaryProject();
			const shadowBin = join(workspace, "shadow-bin");
			mkdirSync(shadowBin, { recursive: true });
			writeFileSync(join(shadowBin, binName), "#!/bin/sh\necho shadow\n", { mode: 0o755 });
			writeFileSync(join(shadowBin, `${binName}.cmd`), "@echo shadow\r\n");
			const probe = join(workspace, "probe.ts");
			writeFileSync(probe, [
				`import { resolveProjectTool } from ${JSON.stringify(join(REPO_ROOT, "core", "tools", "aidlc-project-tool.ts"))};`,
				`const request = ${JSON.stringify({ projectRoot: temporaryProject(), packageName, binName })};`,
				`console.log(JSON.stringify({ onPath: Bun.which(request.binName), resolved: resolveProjectTool(request) }));`,
			].join("\n"));
			const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
			const shadowedPath = [shadowBin, process.env[pathKey]].join(process.platform === "win32" ? ";" : ":");
			const result = spawnSync(process.execPath, [probe], {
				encoding: "utf-8", env: { ...process.env, [pathKey]: shadowedPath },
			});
			const observed = JSON.parse(result.stdout) as { onPath: string | null; resolved: unknown };
			expect(observed.onPath, result.stderr).not.toBeNull();
			expect(observed.resolved).toBeNull();
		},
	);

	test("resolves this repository's lockfile-installed tools", () => {
		for (const [packageName, binName] of [["eslint", "eslint"], ["typescript", "tsc"], ["@biomejs/biome", "biome"]]) {
			expect(resolveProjectTool({ projectRoot: REPO_ROOT, packageName, binName }), packageName).not.toBeNull();
		}
	});
});

describe("projectToolCommand runs the installed CLI under a JavaScript runtime", () => {
	test("the running executable runs the resolved CLI file as Bun, from source or compiled", () => {
		expect(projectToolCommand(eslintAt("10.11.0"), ["--version"])).toEqual({
			executable: process.execPath,
			args: ["/repo/node_modules/eslint/bin/eslint.js", "--version"],
			environment: { BUN_BE_BUN: "1" },
		});
	});

	test("Bun treats the compiled-binary switch as a no-op, so source runs are unchanged", () => {
		const tsc = resolveProjectTool({ projectRoot: REPO_ROOT, packageName: "typescript", binName: "tsc" });
		expect(tsc).not.toBeNull();
		const command = projectToolCommand(tsc as ProjectTool, ["--version"]);
		const result = spawnSync(command.executable, [...command.args], {
			encoding: "utf-8", env: { ...process.env, ...command.environment },
		});
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toMatch(/^Version \d+\.\d+\.\d+/);
	});
});

describe("missingProjectToolMessage tells the reader to install the tool in the repo", () => {
	test("names the package and the project", () => {
		const message = missingProjectToolMessage({ packageName: "typescript", projectRoot: "/repo" });
		expect(message).toContain("typescript");
		expect(message).toContain("/repo");
		expect(message).toContain("install");
	});
});

describe("linter sensor adopts the project's installed ESLint", () => {
	test("a repo on ESLint 9 with no lint script runs its own ESLint 9", () => {
		expect(selectInstalledEslint("/repo", fixedResolver(eslintAt("9.39.5"))))
			.toEqual({ kind: "installed", tool: eslintAt("9.39.5") });
	});

	test("a repo on ESLint 10 runs its own ESLint 10", () => {
		expect(selectInstalledEslint("/repo", fixedResolver(eslintAt("10.11.0"))))
			.toEqual({ kind: "installed", tool: eslintAt("10.11.0") });
	});

	test("a pre-flat-config ESLint is reported unavailable, not run", () => {
		const selection = selectInstalledEslint("/repo", fixedResolver(eslintAt("8.57.0")));
		expect(selection.kind).toBe("unavailable");
		expect(selection.kind === "unavailable" && selection.message).toContain("8.57.0");
	});

	test("a repo without ESLint is told to install it", () => {
		const selection = selectInstalledEslint("/repo", fixedResolver(null));
		expect(selection).toEqual({
			kind: "unavailable",
			message: `eslint-unavailable: ${missingProjectToolMessage({ packageName: "eslint", projectRoot: "/repo" })}`,
		});
	});

	test("asks the resolver for the eslint bin from the project root", () => {
		const requests: ProjectToolRequest[] = [];
		selectInstalledEslint("/repo", (request) => { requests.push(request); return null; });
		expect(requests).toEqual([{ projectRoot: "/repo", packageName: "eslint", binName: "eslint" }]);
	});
});

describe("type-check sensor adopts the project's installed TypeScript", () => {
	const typescriptAt = (version: string): ProjectTool => ({
		packageName: "typescript", version, cliPath: "/repo/node_modules/typescript/bin/tsc",
	});

	test("runs whichever TypeScript the project installed", () => {
		expect(selectInstalledTsc("/repo", fixedResolver(typescriptAt("5.4.5"))))
			.toEqual({ kind: "installed", tool: typescriptAt("5.4.5") });
	});

	test("a repo without TypeScript is told to install it", () => {
		expect(selectInstalledTsc("/repo", fixedResolver(null))).toEqual({
			kind: "unavailable",
			message: `tsc-unavailable: ${missingProjectToolMessage({ packageName: "typescript", projectRoot: "/repo" })}`,
		});
	});
});

describe("no sensor spawns a fetch-and-run launcher", () => {
	const launcher = /["'`](?:bunx|npx|pnpx)["'`]|["'`]bun["'`]\s*,\s*\[\s*["'`]x["'`]|["'`]dlx["'`]|--package["'`]?\s*,\s*["'`]typescript@/;
	for (const source of [
		"core/tools/aidlc-sensor-linter.ts",
		"core/tools/aidlc-sensor-type-check.ts",
		"core/tools/aidlc-project-tool.ts",
		"plugins/rin/tools/rin-harness-sensor-format.ts",
	]) {
		test(source, () => {
			expect(readFileSync(join(REPO_ROOT, source), "utf-8")).not.toMatch(launcher);
		});
	}
});
