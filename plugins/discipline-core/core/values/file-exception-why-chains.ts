import { z } from "zod";

export const fileExceptionWhyChainsSchema = z.enum(["required", "optional"]);

export type FileExceptionWhyChains = z.infer<typeof fileExceptionWhyChainsSchema>;
