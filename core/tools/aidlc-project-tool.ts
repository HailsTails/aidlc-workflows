import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { compiledExecutable } from "./aidlc-runtime-paths.ts";

export interface ProjectToolRequest {
	readonly projectRoot: string;
	readonly packageName: string;
	readonly binName: string;
}

export interface ProjectTool {
	readonly packageName: string;
	readonly version: string;
	readonly cliPath: string;
}

export type ProjectToolResolver = (request: ProjectToolRequest) => ProjectTool | null;

export type ProjectToolSelection =
	| { readonly kind: "installed"; readonly tool: ProjectTool }
	| { readonly kind: "unavailable"; readonly message: string };

export interface ProjectToolCommand {
	readonly executable: string;
	readonly args: readonly string[];
	readonly environment: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ancestorDirectories(start: string): string[] {
	const parent = dirname(start);
	return parent === start ? [start] : [start, ...ancestorDirectories(parent)];
}

function readManifest(manifestPath: string): Record<string, unknown> | null {
	try {
		const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf-8"));
		return isRecord(manifest) ? manifest : null;
	} catch {
		return null;
	}
}

function binRelativePath(manifest: Record<string, unknown>, binName: string): string | null {
	const { bin } = manifest;
	if (typeof bin === "string") return bin;
	if (!isRecord(bin)) return null;
	const entry = bin[binName];
	return typeof entry === "string" ? entry : null;
}

function installedTool(packageDirectory: string, request: ProjectToolRequest): ProjectTool | null {
	const manifest = readManifest(join(packageDirectory, "package.json"));
	if (!manifest || manifest.name !== request.packageName || typeof manifest.version !== "string") return null;
	const relativeCli = binRelativePath(manifest, request.binName);
	if (!relativeCli) return null;
	const cliPath = join(realpathSync(packageDirectory), relativeCli);
	return existsSync(cliPath) ? { packageName: request.packageName, version: manifest.version, cliPath } : null;
}

export const resolveProjectTool: ProjectToolResolver = (request) => {
	const packageDirectory = ancestorDirectories(resolve(request.projectRoot))
		.map((directory) => join(directory, "node_modules", request.packageName))
		.find((candidate) => existsSync(join(candidate, "package.json")));
	return packageDirectory ? installedTool(packageDirectory, request) : null;
};

export function missingProjectToolMessage(input: { packageName: string; projectRoot: string }): string {
	return `${input.packageName} is not installed in ${input.projectRoot} or its parent directories; ` +
		`install ${input.packageName} as a devDependency of this repository to enable this sensor`;
}

export function selectProjectTool(input: {
	request: ProjectToolRequest;
	unavailableCode: string;
	resolveTool: ProjectToolResolver;
}): ProjectToolSelection {
	const tool = input.resolveTool(input.request);
	return tool
		? { kind: "installed", tool }
		: { kind: "unavailable", message: `${input.unavailableCode}: ${missingProjectToolMessage(input.request)}` };
}

export function projectToolCommand(
	tool: ProjectTool,
	args: readonly string[],
	aidlcExecutable: string | null = compiledExecutable(),
): ProjectToolCommand {
	return aidlcExecutable
		? { executable: aidlcExecutable, args: [tool.cliPath, ...args], environment: { BUN_BE_BUN: "1" } }
		: { executable: process.execPath, args: [tool.cliPath, ...args], environment: {} };
}
