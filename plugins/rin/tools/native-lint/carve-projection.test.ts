import { expect, test } from "bun:test";
import {
	projectCarveFragments,
	verifyCarveDocuments,
} from "./carve-projection.ts";

test("generic projection merges exact files and only their selected rule owners", () => {
	expect(
		projectCarveFragments({
			owners: [
				{
					cd: "CD-14",
					eslint: ["rin-discipline/no-class-authoring"],
					oxlint: ["rin-discipline/no-class-authoring"],
				},
				{ cd: "CD-42", eslint: ["no-else-return"], oxlint: ["no-else-return"] },
			],
			sidecars: [
				{ cd: "CD-42", files: ["src/legacy.ts"] },
				{
					cd: "CD-14",
					files: ["src/legacy.ts", "src/legacy.ts", "test/legacy.ts"],
				},
				{ cd: "CD-99", files: ["src/other.ts"] },
			],
		}),
	).toEqual({
		kind: "accepted",
		content: {
			eslint: [
				{
					files: ["src/legacy.ts"],
					rules: {
						"rin-discipline/no-class-authoring": "off",
						"no-else-return": "off",
					},
				},
				{
					files: ["test/legacy.ts"],
					rules: { "rin-discipline/no-class-authoring": "off" },
				},
			],
			oxlint: {
				overrides: [
					{
						files: ["src/legacy.ts"],
						rules: {
							"rin-discipline/no-class-authoring": "off",
							"no-else-return": "off",
						},
					},
					{
						files: ["test/legacy.ts"],
						rules: { "rin-discipline/no-class-authoring": "off" },
					},
				],
			},
		},
	});
});
test("shared ESLint ownership is refused even before any carve exists", () => {
	expect(
		projectCarveFragments({
			owners: [
				{ cd: "CD-42", eslint: ["shared"], oxlint: ["unique-a"] },
				{ cd: "CD-44", eslint: ["shared"], oxlint: ["unique-b"] },
			],
			sidecars: [],
		}),
	).toEqual({
		kind: "rejected",
		failure: {
			message:
				"Selected CDs share ESLint rule shared; separate rule ownership before carving",
		},
	});
});
test("Oxlint builtin aliases cannot hide shared ownership", () => {
	expect(
		projectCarveFragments({
			owners: [
				{ cd: "CD-42", eslint: ["unique-a"], oxlint: ["no-else-return"] },
				{
					cd: "CD-44",
					eslint: ["unique-b"],
					oxlint: ["eslint/no-else-return"],
				},
			],
			sidecars: [],
		}),
	).toEqual({
		kind: "rejected",
		failure: {
			message:
				"Selected CDs share Oxlint rule no-else-return; separate rule ownership before carving",
		},
	});
});
test("a wildcard sidecar cannot produce broad suppressions", () => {
	expect(
		projectCarveFragments({
			owners: [{ cd: "CD-14", eslint: ["class-rule"], oxlint: ["class-rule"] }],
			sidecars: [{ cd: "CD-14", files: ["src/*.ts"] }],
		}),
	).toEqual({
		kind: "rejected",
		failure: {
			message:
				"Carve projection requires an exact project-relative file: src/*.ts",
		},
	});
});
test("unaltered generated documents pass drift checking", () => {
	expect(
		verifyCarveDocuments({
			expected: { eslint: "[]\n", oxlint: "{}\n" },
			actual: { eslint: "[]\n", oxlint: "{}\n" },
		}),
	).toEqual({ kind: "accepted", content: undefined });
});
test("a hand-edited suppression fails drift checking", () => {
	expect(
		verifyCarveDocuments({
			expected: { eslint: "[]\n", oxlint: "{}\n" },
			actual: { eslint: '[{"files":["**/*"]}]\n', oxlint: "{}\n" },
		}),
	).toEqual({
		kind: "rejected",
		failure: {
			message:
				"Native carve fragments drift from canonical sidecars; regenerate them",
		},
	});
});

test("extglob syntax cannot broaden an exact sidecar file", () => {
	expect(
		projectCarveFragments({
			owners: [{ cd: "CD-14", eslint: ["class-rule"], oxlint: ["class-rule"] }],
			sidecars: [{ cd: "CD-14", files: ["src/@(legacy).ts"] }],
		}),
	).toEqual({
		kind: "rejected",
		failure: {
			message:
				"Carve projection requires an exact project-relative file: src/@(legacy).ts",
		},
	});
});
