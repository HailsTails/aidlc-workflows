import { pathStatus } from "../domain/model.ts";
import type { NativeRunnerRequirementRules } from "../application/native-runner-requirements.ts";
export const createNativeRunnerRequirementRules = (): NativeRunnerRequirementRules => ({ path: pathStatus, digest: ({ bytes }) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex") });
