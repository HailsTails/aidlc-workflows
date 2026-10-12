// covers: tool:aidlc-sensor-linter
import { describe, expect, test, mock } from "bun:test";
import { executeProjectLint, parseArgs, projectLintOutput, selectProjectLint } from "../../core/tools/aidlc-sensor-linter.ts";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../../core/tools/aidlc-runtime-budget.ts";

describe("consumer lint-script selection", () => {
	test("runs the declared pnpm script without appending the written file or ESLint flags", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "biome lint ." }, packageManager: "pnpm@10.0.0" } }))
			.toEqual({ kind: "script", executable: "pnpm", args: ["run", "lint"] });
	});
	test("supports npm script convention", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "custom-linter" } } }))
			.toEqual({ kind: "script", executable: "npm", args: ["run", "lint"] });
	});
	test("supports Yarn", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" }, packageManager: "yarn@4.0.0" } }))
			.toEqual({ kind: "script", executable: "yarn", args: ["run", "lint"] });
	});
	test("supports Bun", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" }, packageManager: "bun@1.4.2" }, platform: "win32" }))
			.toEqual({ kind: "script", executable: "bun", args: ["run", "lint"] });
	});
	test("uses lockfile convention without a packageManager field", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" } }, lockfiles: ["pnpm-lock.yaml"] }))
			.toEqual({ kind: "script", executable: "pnpm", args: ["run", "lint"] });
	});
	test("explicit manager overrides the manifest and lockfiles", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" }, packageManager: "yarn@4" }, packageManager: "pnpm", lockfiles: ["bun.lock"] }))
			.toEqual({ kind: "script", executable: "pnpm", args: ["run", "lint"] });
	});
	test("refuses conflicting lockfiles", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" } }, lockfiles: ["bun.lock", "pnpm-lock.yaml"] }))
			.toEqual({ kind: "error", reason: "ambiguous-package-manager" });
	});
	test("does not invoke an arbitrary executable from packageManager", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" }, packageManager: "other@1" } }))
			.toEqual({ kind: "error", reason: "unsupported-package-manager" });
	});
	test("rejects malformed package metadata", () => {
		expect(selectProjectLint({ manifest: [] })).toEqual({ kind: "error", reason: "invalid-package-json" });
	});
	test("rejects malformed scripts rather than silently falling back", () => {
		expect(selectProjectLint({ manifest: { scripts: [] } }))
			.toEqual({ kind: "error", reason: "invalid-lint-script" });
	});
	test("rejects malformed manager metadata", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" }, packageManager: 42 } }))
			.toEqual({ kind: "error", reason: "invalid-package-manager" });
	});
	test("rejects an empty lint script instead of silently falling back", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "  " } } }))
			.toEqual({ kind: "error", reason: "invalid-lint-script" });
	});
	test("preserves the legacy ESLint fallback only when no script is declared", () => {
		expect(selectProjectLint({ manifest: {} })).toEqual({ kind: "eslint" });
	});
	test("required project mode reports the absent script", () => {
		expect(selectProjectLint({ manifest: {}, runner: "project" }))
			.toEqual({ kind: "error", reason: "no-lint-script" });
	});
	test("explicit ESLint mode preserves the pinned fallback", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" } }, runner: "eslint" }))
			.toEqual({ kind: "eslint" });
	});
	test("uses the Windows package manager shim with a fixed command", () => {
		expect(selectProjectLint({ manifest: { scripts: { lint: "check" }, packageManager: "pnpm@10" }, platform: "win32" }))
			.toEqual({ kind: "script", executable: "cmd.exe", args: ["/d", "/s", "/c", "pnpm.cmd run lint"] });
	});
});

describe("consumer lint-script verdict", () => {
	test("arbitrary text on success is not interpreted as ESLint JSON", () => {
		expect(projectLintOutput({ filePath: "fixture.ts", status: 0, stdout: "lint banner\nclean", stderr: "warning" }))
			.toEqual({ pass: true, errorCount: 0, warningCount: 0, findings_count: 0, violations: [] });
	});
	test("nonzero script exit fails with its diagnostics", () => {
		expect(projectLintOutput({ filePath: "fixture.ts", status: 1, stdout: "bad source", stderr: "lint failed" }))
			.toEqual({ pass: false, errorCount: 1, warningCount: 0, findings_count: 1,
				violations: [{ file: "fixture.ts", line: 0, column: 0, severity: "error", rule: "lint-script-failed",
					message: "Project lint exited 1.\nlint failed\nbad source" }] });
	});
	test("a killed run cannot pass with clean-looking stdout", () => {
		expect(projectLintOutput({ filePath: "fixture.ts", status: null, signal: "SIGTERM", stdout: "clean", stderr: "" }).pass).toBe(false);
	});
	test("spawn failure cannot pass", () => {
		expect(projectLintOutput({ filePath: "fixture.ts", status: 0, error: { code: "ENOENT" }, stdout: "", stderr: "" }).violations)
			.toEqual([{ file: "fixture.ts", line: 0, column: 0, severity: "error", rule: "lint-execution-incomplete", message: "Project lint did not complete." }]);
	});
	test("delegates once in the configured directory and uses the existing runtime budget", () => {
		const execute = mock(() => ({ status: 0, stdout: "done", stderr: "" }));
		const output = executeProjectLint({ plan: { kind: "script", executable: "bun", args: ["run", "lint"] },
			projectRoot: "/fixture/workspace", filePath: "/fixture/workspace/package/source.ts", execute });
		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute).toHaveBeenCalledWith({ executable: "bun", args: ["run", "lint"], cwd: "/fixture/workspace", timeout: DEFAULT_SUBPROCESS_TIMEOUT_MS });
		expect(output.pass).toBe(true);
	});
});


describe("lint configuration passed through the existing sensor worker environment", () => {
	test("reads process-scoped defaults for automatic sensor fires", () => {
		const options = parseArgs(["--stage", "code-generation", "--file-path", "fixture.ts"], {
			AIDLC_LINT_PROJECT_DIR: "/fixture/workspace", AIDLC_LINT_PACKAGE_MANAGER: "pnpm", AIDLC_LINT_RUNNER: "project",
		});
		expect(options.projectDir).toBe("/fixture/workspace");
		expect(options.packageManager).toBe("pnpm");
		expect(options.runner).toBe("project");
	});
	test("a direct runner flag overrides an invalid environment default", () => {
		expect(parseArgs(["--stage", "code-generation", "--file-path", "fixture.ts", "--runner", "eslint"], { AIDLC_LINT_RUNNER: "invalid" }).runner).toBe("eslint");
	});
	test("direct command flags override process-scoped defaults", () => {
		const options = parseArgs(["--stage", "code-generation", "--file-path", "fixture.ts", "--project-dir", "/fixture/package", "--package-manager", "bun", "--runner", "eslint"], {
			AIDLC_LINT_PROJECT_DIR: "/fixture/workspace", AIDLC_LINT_PACKAGE_MANAGER: "pnpm", AIDLC_LINT_RUNNER: "project",
		});
		expect(options.projectDir).toBe("/fixture/package");
		expect(options.packageManager).toBe("bun");
		expect(options.runner).toBe("eslint");
	});
});
