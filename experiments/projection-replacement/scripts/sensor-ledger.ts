export type SourceEvidence = {
  readonly baseline: string;
  readonly pin: string;
  readonly path: string;
  readonly sha256: string;
  readonly gitBlob: string;
  readonly observedSha256: string;
  readonly observedGitBlob: string;
};
export type OutputEvidence = {
  readonly baseline: string;
  readonly harness: string;
  readonly channel: string;
  readonly path: string;
  readonly comparison: "matches" | "differs";
  readonly sha256: string;
  readonly command: string;
  readonly observedSha256: string;
  readonly observedCommand: string;
};
export type FixtureEvidence = {
  readonly baseline: string;
  readonly harness: string;
  readonly channel: string;
  readonly kind: string;
  readonly inputSha256: string;
  readonly expectedSha256: string;
  readonly resourceSha256: string;
  readonly path: string;
};
export type SensorEvidence = {
  readonly sources: readonly SourceEvidence[];
  readonly outputs: readonly OutputEvidence[];
  readonly fixtures: readonly FixtureEvidence[];
};
const sourceFindings = (source: SourceEvidence): readonly string[] => [
  ...(source.sha256 === source.observedSha256
    ? []
    : [`source bytes: ${source.baseline}/${source.path}`]),
  ...(source.gitBlob === source.observedGitBlob
    ? []
    : [`source blob: ${source.baseline}/${source.path}`]),
];
const outputFindings = (output: OutputEvidence): readonly string[] => [
  ...(output.sha256 === output.observedSha256
    ? []
    : [`output bytes: ${output.baseline}/${output.channel}/${output.harness}`]),
  ...(output.command === output.observedCommand
    ? []
    : [`output command: ${output.baseline}/${output.channel}/${output.harness}`]),
];
const fixtureFindings = ({
  fixture,
  sources,
  outputs,
}: {
  readonly fixture: FixtureEvidence;
  readonly sources: readonly SourceEvidence[];
  readonly outputs: readonly OutputEvidence[];
}): readonly string[] => {
  const subject = `${fixture.baseline}/${fixture.channel}/${fixture.harness}/${fixture.kind}`;
  const sourcePath =
    fixture.kind === "core"
      ? "core/sensors/aidlc-linter.md"
      : "plugins/test-pro/sensors/aidlc-coverage-threshold.md";
  const source = sources.find(
    (entry) => entry.baseline === fixture.baseline && entry.path === sourcePath,
  );
  const channel = fixture.kind === "plugin" ? "plugin-repository" : `core-${fixture.channel}`;
  const retained = outputs.filter(
    (entry) =>
      entry.baseline === fixture.baseline &&
      entry.harness === fixture.harness &&
      entry.channel.startsWith(fixture.kind === "plugin" ? "plugin-" : channel),
  );
  const reference = outputs.find(
    (entry) =>
      entry.baseline === (fixture.kind === "plugin" ? "fork" : fixture.baseline) &&
      entry.harness === fixture.harness &&
      entry.channel === channel,
  );
  const placement = outputs.find(
    (entry) =>
      entry.baseline === fixture.baseline &&
      entry.harness === fixture.harness &&
      entry.channel === channel,
  );
  return [
    ...(source?.sha256 === fixture.inputSha256 ? [] : [`fixture source: ${subject}`]),
    ...(reference?.sha256 === fixture.expectedSha256 ? [] : [`fixture expectation: ${subject}`]),
    ...(fixture.resourceSha256 === fixture.expectedSha256 ? [] : [`fixture resource: ${subject}`]),
    ...(placement?.path === fixture.path ? [] : [`fixture placement: ${subject}`]),
    ...retained.flatMap((entry) =>
      (entry.sha256 === fixture.expectedSha256) === (entry.comparison === "matches")
        ? []
        : [`comparison claim: ${entry.baseline}/${entry.channel}/${entry.harness}`],
    ),
  ];
};
const duplicateFindings = ({
  keys,
  category,
}: {
  readonly keys: readonly string[];
  readonly category: string;
}): readonly string[] => (keys.length === new Set(keys).size ? [] : [`duplicate ${category}`]);
export const verifySensorEvidence = ({
  sources,
  outputs,
  fixtures,
}: SensorEvidence): readonly string[] => [
  ...duplicateFindings({
    keys: sources.map((entry) => `${entry.baseline}/${entry.path}`),
    category: "sources",
  }),
  ...duplicateFindings({
    keys: outputs.map((entry) => `${entry.baseline}/${entry.channel}/${entry.harness}`),
    category: "outputs",
  }),
  ...duplicateFindings({
    keys: fixtures.map(
      (entry) => `${entry.baseline}/${entry.channel}/${entry.harness}/${entry.kind}`,
    ),
    category: "fixtures",
  }),
  ...sources.flatMap(sourceFindings),
  ...outputs.flatMap(outputFindings),
  ...fixtures.flatMap((fixture) => fixtureFindings({ fixture, sources, outputs })),
];

export type SensorFixtureIdentity = Pick<
  FixtureEvidence,
  "baseline" | "harness" | "channel" | "kind"
>;
const fixtureBaselines = new Set(["upstream", "fork"]);
const fixtureHarnesses = new Set([
  "claude",
  "codex",
  "copilot",
  "cursor",
  "kiro",
  "kiro-ide",
  "opencode",
]);
const fixtureSlots = new Set(["copy/core", "copy/plugin", "native/core"]);
export const verifySensorFixtureCoverage = ({
  fixtures,
}: {
  readonly fixtures: readonly SensorFixtureIdentity[];
}): readonly string[] => {
  const requiredCount = fixtureBaselines.size * fixtureHarnesses.size * fixtureSlots.size;
  const identities = fixtures.map(
    (fixture) => `${fixture.baseline}/${fixture.harness}/${fixture.channel}/${fixture.kind}`,
  );
  if (
    fixtures.length !== requiredCount ||
    new Set(identities).size !== requiredCount ||
    fixtures.some(
      (fixture) =>
        !fixtureBaselines.has(fixture.baseline) ||
        !fixtureHarnesses.has(fixture.harness) ||
        !fixtureSlots.has(`${fixture.channel}/${fixture.kind}`),
    )
  )
    return ["expected complete sensor fixture coverage"];
  return [];
};

export type SensorFixtureStructure = {
  readonly input: { readonly documents: readonly unknown[] };
  readonly resources: readonly unknown[];
};
export const verifySensorFixtureShape = ({
  fixtures,
}: {
  readonly fixtures: readonly SensorFixtureStructure[];
}): readonly string[] =>
  fixtures.some((fixture) => fixture.input.documents.length !== 1 || fixture.resources.length !== 1)
    ? ["expected one document and resource per fixture"]
    : [];
