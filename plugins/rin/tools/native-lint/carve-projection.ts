export type CarveRuleOwner = {
	readonly cd: string;
	readonly eslint: readonly string[];
	readonly oxlint: readonly string[];
};
export type CarveSidecar = {
	readonly cd: string;
	readonly files: readonly string[];
};
export type CarveOverride = {
	readonly files: readonly string[];
	readonly rules: Readonly<Record<string, "off">>;
};
export type CarveFragments = {
	readonly eslint: readonly CarveOverride[];
	readonly oxlint: { readonly overrides: readonly CarveOverride[] };
};
export type CarveFailure = { readonly message: string };
export type CarveOutcome<Content> =
	| { readonly kind: "accepted"; readonly content: Content }
	| { readonly kind: "rejected"; readonly failure: CarveFailure };
export const nativeCarveOwners: readonly CarveRuleOwner[] = [
	{
		cd: "CD-14",
		eslint: ["rin-discipline/no-class-authoring"],
		oxlint: ["rin-discipline/no-class-authoring"],
	},
	{ cd: "CD-42", eslint: ["no-else-return"], oxlint: ["no-else-return"] },
	{ cd: "CD-44", eslint: ["no-param-reassign"], oxlint: ["no-param-reassign"] },
];
const canonicalRuleId = ({
	engine,
	rule,
}: {
	readonly engine: "eslint" | "oxlint";
	readonly rule: string;
}): string => {
	if (engine === "oxlint" && rule.startsWith("eslint/")) return rule.slice(7);
	return rule;
};
const sharedRule = ({
	engine,
	owners,
}: {
	readonly engine: "eslint" | "oxlint";
	readonly owners: readonly CarveRuleOwner[];
}): string | undefined => {
	const claims = owners.flatMap((owner) =>
		owner[engine].map((rule) => ({
			cd: owner.cd,
			rule: canonicalRuleId({ engine, rule }),
		})),
	);
	return claims.find((claim) =>
		claims.some((other) => other.cd !== claim.cd && other.rule === claim.rule),
	)?.rule;
};
const invalidFile = ({ filename }: { readonly filename: string }): boolean =>
	!filename ||
	filename.includes("\\") ||
	filename.startsWith("/") ||
	/^[a-z]:/iu.test(filename) ||
	/[*?![\]{}()]/u.test(filename) ||
	filename
		.split("/")
		.some((segment) => !segment || segment === "." || segment === "..");
const engineOverrides = ({
	engine,
	owners,
	sidecars,
}: {
	readonly engine: "eslint" | "oxlint";
	readonly owners: readonly CarveRuleOwner[];
	readonly sidecars: readonly CarveSidecar[];
}): readonly CarveOverride[] => {
	const files = [
		...new Set(
			sidecars
				.filter((sidecar) => owners.some((owner) => owner.cd === sidecar.cd))
				.flatMap((sidecar) => sidecar.files),
		),
	].sort();
	return files.map((filename) => ({
		files: [filename],
		rules: Object.fromEntries(
			owners
				.filter((owner) =>
					sidecars.some(
						(sidecar) =>
							sidecar.cd === owner.cd && sidecar.files.includes(filename),
					),
				)
				.flatMap((owner) => owner[engine].map((rule) => [rule, "off"])),
		),
	}));
};
export const projectCarveFragments = ({
	owners,
	sidecars,
}: {
	readonly owners: readonly CarveRuleOwner[];
	readonly sidecars: readonly CarveSidecar[];
}): CarveOutcome<CarveFragments> => {
	const eslintCollision = sharedRule({ engine: "eslint", owners });
	if (eslintCollision !== undefined)
		return {
			kind: "rejected",
			failure: {
				message: `Selected CDs share ESLint rule ${eslintCollision}; separate rule ownership before carving`,
			},
		};
	const oxlintCollision = sharedRule({ engine: "oxlint", owners });
	if (oxlintCollision !== undefined)
		return {
			kind: "rejected",
			failure: {
				message: `Selected CDs share Oxlint rule ${oxlintCollision}; separate rule ownership before carving`,
			},
		};
	const badFile = sidecars
		.filter((sidecar) => owners.some((owner) => owner.cd === sidecar.cd))
		.flatMap((sidecar) => sidecar.files)
		.find((filename) => invalidFile({ filename }));
	if (badFile !== undefined)
		return {
			kind: "rejected",
			failure: {
				message: `Carve projection requires an exact project-relative file: ${badFile}`,
			},
		};
	return {
		kind: "accepted",
		content: {
			eslint: engineOverrides({ engine: "eslint", owners, sidecars }),
			oxlint: {
				overrides: engineOverrides({ engine: "oxlint", owners, sidecars }),
			},
		},
	};
};
export type CarveDocuments = {
	readonly eslint: string;
	readonly oxlint: string;
};
export const serializeCarveFragments = ({
	fragments,
}: {
	readonly fragments: CarveFragments;
}): CarveDocuments => ({
	eslint: `${JSON.stringify(fragments.eslint, null, 2)}\n`,
	oxlint: `${JSON.stringify(fragments.oxlint, null, 2)}\n`,
});
export const verifyCarveDocuments = ({
	expected,
	actual,
}: {
	readonly expected: CarveDocuments;
	readonly actual: CarveDocuments;
}): CarveOutcome<void> => {
	if (expected.eslint !== actual.eslint || expected.oxlint !== actual.oxlint)
		return {
			kind: "rejected",
			failure: {
				message:
					"Native carve fragments drift from canonical sidecars; regenerate them",
			},
		};
	return { kind: "accepted", content: undefined };
};
