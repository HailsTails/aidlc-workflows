import { z } from "zod";
import { SESSION_BINDING_SOURCES } from "../domain/session.ts";

export const SessionBindingFileSchema = z.object({
  space: z.string().min(1),
  intent: z.string().min(1).nullable(),
  boundAt: z.iso.datetime(),
  source: z.enum(SESSION_BINDING_SOURCES).optional(),
});

export type SessionBindingFile = z.infer<typeof SessionBindingFileSchema>;
