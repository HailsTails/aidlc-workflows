import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
	nativeCarveOwners,
	selectCanonicalSidecars,
	projectCarveFragments,
	serializeCarveFragments,
	verifyCarveDocuments,
	type CarveDocuments,
	type CarveOutcome,
	type CarveRuleOwner,
	type CarveSidecar,
} from "./carve-projection.ts";

export type CarveCommand = {
	readonly projectDir: string;
	readonly mode: "generate" | "check";
	readonly owners: readonly CarveRuleOwner[];
};
export type CarveFilePort = {
	readonly readSidecars: (input: {
		readonly command: CarveCommand;
	}) => CarveOutcome<readonly CarveSidecar[]>;
	readonly readDocuments: (input: {
		readonly projectDir: string;
	}) => CarveOutcome<CarveDocuments>;
	readonly writeDocuments: (input: {
		readonly projectDir: string;
		readonly documents: CarveDocuments;
	}) => CarveOutcome<void>;
};
const sidecarSchema = z.array(z.object({ files: z.array(z.string()) }));
export const parseProjectionSidecar = ({
	cd,
	source,
}: {
	readonly cd: string;
	readonly source: string;
}): CarveOutcome<CarveSidecar> => {
	try {
		const untrusted: unknown = JSON.parse(source);
		const parsed = sidecarSchema.safeParse(untrusted);
		if (!parsed.success)
			return {
				kind: "rejected",
				failure: { message: `${cd} sidecar must contain file arrays` },
			};
		return {
			kind: "accepted",
			content: { cd, files: parsed.data.flatMap((entry) => entry.files) },
		};
	} catch {
		return {
			kind: "rejected",
			failure: { message: `${cd} sidecar must be valid JSON` },
		};
	}
};
export const defaultCarveFilePort = (): CarveFilePort => ({
	readSidecars: ({ command }) => {
		try {
			const directory = join(
				resolve(command.projectDir),
				".constitution-carve-outs",
			);
			if (!existsSync(directory)) return { kind: "accepted", content: [] };
			const sidecars = selectCanonicalSidecars({
				owners: command.owners,
				filenames: readdirSync(directory),
			}).map((sidecar) =>
				parseProjectionSidecar({
					cd: sidecar.cd,
					source: readFileSync(join(directory, sidecar.filename), "utf8"),
				}),
			);
			const rejected = sidecars.find((sidecar) => sidecar.kind === "rejected");
			if (rejected?.kind === "rejected") return rejected;
			return {
				kind: "accepted",
				content: sidecars.flatMap((sidecar) =>
					sidecar.kind === "accepted" ? [sidecar.content] : [],
				),
			};
		} catch {
			return {
				kind: "rejected",
				failure: { message: "Could not read canonical carve sidecars" },
			};
		}
	},
	readDocuments: ({ projectDir }) => {
		try {
			const directory = join(resolve(projectDir), ".rin", "native-lint");
			return {
				kind: "accepted",
				content: {
					eslint: readFileSync(join(directory, "carve.eslint.json"), "utf8"),
					oxlint: readFileSync(join(directory, "carve.oxlint.json"), "utf8"),
				},
			};
		} catch {
			return {
				kind: "rejected",
				failure: {
					message: "Could not read native carve fragments; generate them first",
				},
			};
		}
	},
	writeDocuments: ({ projectDir, documents }) => {
		try {
			const directory = join(resolve(projectDir), ".rin", "native-lint");
			mkdirSync(directory, { recursive: true });
			writeFileSync(join(directory, "carve.eslint.json"), documents.eslint);
			writeFileSync(join(directory, "carve.oxlint.json"), documents.oxlint);
			return { kind: "accepted", content: undefined };
		} catch {
			return {
				kind: "rejected",
				failure: { message: "Could not write native carve fragments" },
			};
		}
	},
});
export const runCarveProjection = ({
	command,
	port,
}: {
	readonly command: CarveCommand;
	readonly port: CarveFilePort;
}): CarveOutcome<void> => {
	const sidecars = port.readSidecars({ command });
	if (sidecars.kind === "rejected") return sidecars;
	const projected = projectCarveFragments({
		owners: command.owners,
		sidecars: sidecars.content,
	});
	if (projected.kind === "rejected") return projected;
	const expected = serializeCarveFragments({ fragments: projected.content });
	if (command.mode === "generate")
		return port.writeDocuments({
			projectDir: command.projectDir,
			documents: expected,
		});
	const actual = port.readDocuments({ projectDir: command.projectDir });
	if (actual.kind === "rejected") return actual;
	return verifyCarveDocuments({ expected, actual: actual.content });
};
export const parseCarveCommand = ({
	arguments: argumentsList,
	projectDir,
}: {
	readonly arguments: readonly string[];
	readonly projectDir: string;
}): CarveOutcome<CarveCommand> => {
	const unknownFlag = argumentsList.find(
		(argument) =>
			argument.startsWith("--") &&
			!["--cd", "--project-dir", "--check"].includes(argument),
	);
	if (unknownFlag !== undefined)
		return {
			kind: "rejected",
			failure: { message: `Unknown carve projection option: ${unknownFlag}` },
		};
	const selected = argumentsList.flatMap((argument, index) =>
		argument === "--cd" ? [argumentsList[index + 1]] : [],
	);
	if (
		selected.length === 0 ||
		selected.some((cd) => !nativeCarveOwners.some((owner) => owner.cd === cd))
	)
		return {
			kind: "rejected",
			failure: {
				message:
					"Select supported fragments with --cd CD-14, --cd CD-42, or --cd CD-44",
			},
		};
	const rootIndex = argumentsList.indexOf("--project-dir");
	const projectRoot = rootIndex < 0 ? projectDir : argumentsList[rootIndex + 1];
	if (projectRoot === undefined || !projectRoot.trim())
		return {
			kind: "rejected",
			failure: { message: "--project-dir needs a directory" },
		};
	return {
		kind: "accepted",
		content: {
			projectDir: projectRoot,
			mode: argumentsList.includes("--check") ? "check" : "generate",
			owners: nativeCarveOwners.filter((owner) => selected.includes(owner.cd)),
		},
	};
};
export type CarveProcessPort = {
	readonly startup: () => {
		readonly arguments: readonly string[];
		readonly projectDir: string;
	};
	readonly finish: (input: { readonly outcome: CarveOutcome<void> }) => void;
};
export const defaultCarveProcessPort = (): CarveProcessPort => ({
	startup: () => ({
		arguments: process.argv.slice(2),
		projectDir: process.cwd(),
	}),
	finish: ({ outcome }) => {
		if (outcome.kind === "rejected") {
			process.stderr.write(`${outcome.failure.message}\n`);
			process.exitCode = 1;
			return;
		}
		process.stdout.write("Native carve fragments match canonical sidecars.\n");
	},
});
if (
	import.meta.main ||
	(process.argv[1] !== undefined &&
		resolve(process.argv[1]) === fileURLToPath(import.meta.url))
) {
	const processPort = defaultCarveProcessPort();
	const command = parseCarveCommand(processPort.startup());
	const outcome =
		command.kind === "rejected"
			? command
			: runCarveProjection({
					command: command.content,
					port: defaultCarveFilePort(),
				});
	processPort.finish({ outcome });
}
