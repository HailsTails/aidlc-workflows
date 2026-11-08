import type { Owner, SensorId } from "./identities.ts";

export type SensorSeverity = "advisory" | "blocking";

export type SensorTrigger = "write" | "gate";

export type SensorFieldShapes = Readonly<Record<string, string>>;

export type SensorDeclaration = {
  readonly id: SensorId;
  readonly owner: Owner;
  readonly description: string;
  readonly category: string | null;
  readonly command: string;
  readonly severity: SensorSeverity;
  readonly firesOn: SensorTrigger;
  readonly matches: string | null;
  readonly timeoutSeconds: number | null;
  readonly input: SensorFieldShapes;
  readonly output: SensorFieldShapes;
};
