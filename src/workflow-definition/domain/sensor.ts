import type { Owner, SensorId } from "./identities.ts";
import type { MethodSourcePath } from "./method-source.ts";

export type SensorSeverity = "advisory" | "blocking";

export type SensorTrigger = "write" | "gate";

export type SensorFieldShape =
  | { readonly kind: "value"; readonly type: string }
  | { readonly kind: "list-of"; readonly fields: SensorFieldShapes };

export type SensorFieldShapes = Readonly<Record<string, SensorFieldShape>>;

export type SensorDeclaration = {
  readonly id: SensorId;
  readonly source: MethodSourcePath;
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
