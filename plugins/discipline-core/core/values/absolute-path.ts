import { z } from "zod";

const POSIX_ROOT_OR_DRIVE_ROOT = /^(?:\/|[A-Za-z]:[\\/])/;

export const absolutePathSchema = z
  .string()
  .regex(POSIX_ROOT_OR_DRIVE_ROOT)
  .brand<"AbsolutePath">();

export type AbsolutePath = z.infer<typeof absolutePathSchema>;
