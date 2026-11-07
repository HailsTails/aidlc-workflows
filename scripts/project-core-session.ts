import { z } from "zod";
import { copyRequestSchema, projectCorePublicationSession } from "./project-core.ts";
import { harnessBindingSchema } from "./projection/src/adapters/harness-binding-schema.ts";

if (import.meta.main) {
  const input = z.strictObject({ request: copyRequestSchema, steps: z.array(z.strictObject({ binding: harnessBindingSchema, copyRoot: z.string().min(1), nativeRoot: z.string().min(1) })).min(1).max(64) }).parse(await Bun.stdin.json());
  const diagnostics = await projectCorePublicationSession(input.request, input.steps);
  process.stdout.write(diagnostics.stdout); process.stderr.write(diagnostics.stderr);
}
