import { expect, mock, test } from "bun:test";
import {
	parseCarveCommand,
	parseProjectionSidecar,
	runCarveProjection,
	type CarveCommand,
	type CarveFilePort,
} from "./carve-files.ts";

const command: CarveCommand = {
	projectDir: "/fixture",
	mode: "generate",
	owners: [{ cd: "CD-14", eslint: ["class-rule"], oxlint: ["class-rule"] }],
};
const fakePort: CarveFilePort = {
	readSidecars: () => ({ kind: "accepted", content: [] }),
	readDocuments: () => ({
		kind: "accepted",
		content: { eslint: "[]\n", oxlint: '{\n  "overrides": []\n}\n' },
	}),
	writeDocuments: () => ({ kind: "accepted", content: undefined }),
};
test("projection parsing consumes files without judging eligibility fields", () => {
	expect(
		parseProjectionSidecar({
			cd: "CD-14",
			source: '[{"files":["src/legacy.ts"],"reason":false,"decision":null}]',
		}),
	).toEqual({
		kind: "accepted",
		content: { cd: "CD-14", files: ["src/legacy.ts"] },
	});
});
test("malformed consumed file data is rejected", () => {
	expect(
		parseProjectionSidecar({ cd: "CD-14", source: '[{"files":false}]' }),
	).toEqual({
		kind: "rejected",
		failure: { message: "CD-14 sidecar must contain file arrays" },
	});
});
test("generation writes the canonical serialized fragments", () => {
	const writeDocuments = mock<
		CarveFilePort["writeDocuments"]
	>().mockReturnValue({ kind: "accepted", content: undefined });
	expect(
		runCarveProjection({ command, port: { ...fakePort, writeDocuments } }),
	).toEqual({ kind: "accepted", content: undefined });
	expect(writeDocuments).toHaveBeenCalledWith({
		projectDir: "/fixture",
		documents: { eslint: "[]\n", oxlint: '{\n  "overrides": []\n}\n' },
	});
});
test("check mode compares without writing", () => {
	const writeDocuments = mock<CarveFilePort["writeDocuments"]>();
	expect(
		runCarveProjection({
			command: { ...command, mode: "check" },
			port: { ...fakePort, writeDocuments },
		}),
	).toEqual({ kind: "accepted", content: undefined });
	expect(writeDocuments).not.toHaveBeenCalled();
});
test("a sidecar read failure prevents writing", () => {
	const writeDocuments = mock<CarveFilePort["writeDocuments"]>();
	const readSidecars = mock<CarveFilePort["readSidecars"]>().mockReturnValue({
		kind: "rejected",
		failure: { message: "Fixture unreadable" },
	});
	expect(
		runCarveProjection({
			command,
			port: { ...fakePort, readSidecars, writeDocuments },
		}),
	).toEqual({ kind: "rejected", failure: { message: "Fixture unreadable" } });
	expect(writeDocuments).not.toHaveBeenCalled();
});
test("command selection names only adopted CDs", () => {
	expect(
		parseCarveCommand({
			arguments: ["--cd", "CD-14", "--check"],
			projectDir: "/fixture",
		}),
	).toEqual({
		kind: "accepted",
		content: {
			projectDir: "/fixture",
			mode: "check",
			owners: [
				{
					cd: "CD-14",
					eslint: ["rin-discipline/no-class-authoring"],
					oxlint: ["rin-discipline/no-class-authoring"],
				},
			],
		},
	});
});

test("a mistyped drift option cannot silently generate files", () => {
	expect(
		parseCarveCommand({
			arguments: ["--cd", "CD-14", "--chek"],
			projectDir: "/fixture",
		}),
	).toEqual({
		kind: "rejected",
		failure: { message: "Unknown carve projection option: --chek" },
	});
});
