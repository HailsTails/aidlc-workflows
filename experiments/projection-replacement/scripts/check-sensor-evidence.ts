import {
  createEvidenceRepository,
  createEvidenceReporter,
  type EvidenceRepository,
  type EvidenceReporter,
} from "./sensor-evidence.ts";
import { verifySensorEvidence } from "./sensor-ledger.ts";
export type EvidenceCheckDependencies = {
  readonly repository: EvidenceRepository;
  readonly reporter: EvidenceReporter;
  readonly verify: typeof verifySensorEvidence;
};
export const createEvidenceCheckDependencies = (): EvidenceCheckDependencies => ({
  repository: createEvidenceRepository(),
  reporter: createEvidenceReporter(),
  verify: verifySensorEvidence,
});
export const checkSensorEvidence = async ({
  repository,
  reporter,
  verify,
}: EvidenceCheckDependencies): Promise<void> => {
  const loaded = await repository.load();
  if (loaded.status === "invalid") return reporter.finish({ findings: loaded.findings });
  const findings = verify(loaded.evidence);
  reporter.finish({ findings });
};
if (import.meta.main) await checkSensorEvidence(createEvidenceCheckDependencies());
