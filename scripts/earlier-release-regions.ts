import { earlierReleaseRegionsPolicy } from "../src/projection/domain/skill-regions.ts";
export { EARLIER_RELEASE_REGIONS } from "../src/projection/domain/skill-regions.ts";

export const earlierReleasesReadSkill = (skillRel: string, harnessDir: string): boolean =>
  earlierReleaseRegionsPolicy({ skillRel, harnessDir }) === "include";