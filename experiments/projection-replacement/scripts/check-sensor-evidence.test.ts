import { expect, mock, test } from "bun:test";
import { sensorEvidenceFixture } from "../__tests__/sensor-evidence-fixture.ts";
import { checkSensorEvidence } from "./check-sensor-evidence.ts";
import type { EvidenceRepository, EvidenceReporter } from "./sensor-evidence.ts";
import type { verifySensorEvidence } from "./sensor-ledger.ts";
test("command reports the controlled verifier outcome", async () => {
  const evidence = sensorEvidenceFixture();
  const load = mock<EvidenceRepository["load"]>().mockResolvedValue({ status: "ok", evidence });
  const finish = mock<EvidenceReporter["finish"]>();
  const verify = mock<typeof verifySensorEvidence>().mockReturnValue(["controlled finding"]);
  await checkSensorEvidence({ repository: { load }, reporter: { finish }, verify });
  expect(verify).toHaveBeenCalledWith(evidence);
  expect(finish).toHaveBeenCalledWith({ findings: ["controlled finding"] });
});
test("command reports load refusal without running verification", async () => {
  const load = mock<EvidenceRepository["load"]>().mockResolvedValue({
    status: "invalid",
    code: "unreadable-evidence",
    findings: ["unreadable"],
  });
  const finish = mock<EvidenceReporter["finish"]>();
  const verify = mock<typeof verifySensorEvidence>();
  await checkSensorEvidence({ repository: { load }, reporter: { finish }, verify });
  expect(verify).not.toHaveBeenCalled();
  expect(finish).toHaveBeenCalledWith({ findings: ["unreadable"] });
});
