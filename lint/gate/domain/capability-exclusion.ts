export type CapabilityId = "symlinks" | "short-names" | "unattributed";

export type ProbeResult = {
  readonly available: boolean;
  readonly evidence: string;
};

export type CapabilityExclusion = {
  readonly capability: CapabilityId;
  readonly cases: readonly string[];
};

export type ExcludedCases = {
  readonly capability: CapabilityId;
  readonly evidence: string;
  readonly cases: readonly string[];
};

export type Classification = {
  readonly regressions: readonly string[];
  readonly excluded: readonly ExcludedCases[];
};

export type Probes = Readonly<Record<CapabilityId, ProbeResult>>;

const FAILED_CASE = /^\(fail\) (.+?)(?: \[[\d.]+ms\])?\s*$/;

const failedLines = (output: string): readonly string[] =>
  output.split(/\r?\n/).flatMap((line) => {
    const name = FAILED_CASE.exec(line)?.[1];
    return name === undefined ? [] : [name];
  });

export const failedCases = (output: string): readonly string[] =>
  [...new Set(failedLines(output))];

const exclusionFor = (request: {
  readonly failed: string;
  readonly exclusions: readonly CapabilityExclusion[];
  readonly probes: Probes;
}): CapabilityExclusion | undefined =>
  request.exclusions.find(
    (exclusion) =>
      exclusion.cases.includes(request.failed) && !request.probes[exclusion.capability].available,
  );

export const classifyFailures = (request: {
  readonly failed: readonly string[];
  readonly exclusions: readonly CapabilityExclusion[];
  readonly probes: Probes;
}): Classification => {
  const { failed, exclusions, probes } = request;
  const owners = failed.map((name) => ({
    name,
    owner: exclusionFor({ failed: name, exclusions, probes }),
  }));
  const regressions = owners.filter(({ owner }) => owner === undefined).map(({ name }) => name);
  const excluded = [...new Set(owners.flatMap(({ owner }) => (owner ? [owner.capability] : [])))]
    .sort()
    .map((capability) => ({
      capability,
      evidence: probes[capability].evidence,
      cases: owners.filter(({ owner }) => owner?.capability === capability).map(({ name }) => name),
    }));
  return { regressions, excluded };
};

const UNATTRIBUTED_LABEL = "UNATTRIBUTED, not an environment limit: known failing";

const noteOf = (group: ExcludedCases): string => {
  const count = `${group.cases.length} case(s)`;
  return group.capability === "unattributed"
    ? `${count} ${UNATTRIBUTED_LABEL}, ${group.evidence}`
    : `${count} excluded for ${group.capability} (${group.evidence})`;
};

export const excludedNote = (excluded: readonly ExcludedCases[]): string =>
  excluded.map(noteOf).join("; ");
