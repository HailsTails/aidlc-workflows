import type { FrontmatterParser } from "../application/ports.ts";
import { refused, type Result } from "../../kernel/result.ts";
import type { MethodSourceLocation } from "../domain/method-source.ts";
import { sensorId } from "../domain/identities.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { SensorDeclaration, SensorFieldShapes } from "../domain/sensor.ts";
import { decodeMarkdown, translated, authoredValue } from "./authored-markdown.ts";
import { SensorFileSchema, type SensorFieldShapesFile } from "./sensor-file.ts";

const fieldShapes = (fields: SensorFieldShapesFile): SensorFieldShapes =>
  Object.fromEntries(Object.entries(fields).map(([name, shape]) => {
    if (typeof shape === "string") return [name, { kind: "value", type: shape }];
    const [record] = shape;
    if (!record) throw new Error(`Field ${name} must declare one list element shape`);
    return [name, { kind: "list-of", fields: fieldShapes(record) }];
  }));

export const readSensor = (request: { readonly source: MethodSourceLocation; readonly raw: string;
  readonly parser: FrontmatterParser }):
  Result<SensorDeclaration, readonly MethodRefusal[]> => {
  const { source, raw } = request;
  const decoded = decodeMarkdown({ source, raw, parser: request.parser, schema: SensorFileSchema,
    strings: ["id", "kind", "command", "default_severity", "description", "category",
      "fire_on", "matches"] });
  if (!decoded.ok) return decoded;
  const { file } = decoded.value;
  if (source.path.split("/").at(-1) !== `aidlc-${file.id}.md`) {
    return refused([{ kind: "slug-differs-from-file", source, slug: file.id }]);
  }
  return translated(source, () => ({ id: authoredValue(sensorId(file.id)), owner: source.owner, source: source.path,
    description: file.description, category: file.category ?? null, command: file.command,
    severity: file.default_severity, firesOn: file.fire_on, matches: file.matches ?? null,
    timeoutSeconds: file.timeout_seconds ?? null,
    input: fieldShapes(file.input_schema ?? {}), output: fieldShapes(file.output_schema ?? {}),
  }));
};
