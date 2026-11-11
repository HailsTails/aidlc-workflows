import { kiroIdeSteering } from "../../../core/tools/aidlc-includes.ts";

export const kiroIdeSteeringText = (projectRoot: string, space: string): string =>
  kiroIdeSteering(projectRoot, space).text;
