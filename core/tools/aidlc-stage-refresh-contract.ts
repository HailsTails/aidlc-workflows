import { z } from "zod";

export type StageContract =
  | { readonly kind: "comparable"; readonly value: Readonly<Record<string, unknown>> }
  | { readonly kind: "invalid" };

type StageContractInput = { readonly stage: unknown };

const sensor = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  fire_on: z.enum(["write", "gate"]),
  default_severity: z.enum(["advisory", "blocking"]),
  category: z.string().optional(),
  matches: z.string().optional(),
}).strict();

const stageMetadata = z.object({
  sensors: z.array(z.string().min(1)).default([]),
  sensors_applicable: z.array(sensor).default([]),
}).passthrough().refine((stage) =>
  stage.sensors.length === stage.sensors_applicable.length &&
  new Set(stage.sensors).size === stage.sensors.length &&
  stage.sensors.every((id, index) => stage.sensors_applicable[index]?.id === id));

export const stageRefreshContract = ({ stage }: StageContractInput): StageContract => {
  const parsed = stageMetadata.safeParse(stage);
  if (!parsed.success) return { kind: "invalid" };
  const retained = parsed.data.sensors_applicable.filter((entry) =>
    entry.fire_on !== "write" || entry.default_severity !== "advisory");
  return {
    kind: "comparable",
    value: { ...parsed.data, sensors: retained.map((entry) => entry.id), sensors_applicable: retained },
  };
};
