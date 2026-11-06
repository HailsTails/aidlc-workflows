import { z } from "zod";

const POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT = /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/])/;

export const absolutePathSchema = z
  .string()
  .regex(POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT)
  .brand<"AbsolutePath">();

export type AbsolutePath = z.infer<typeof absolutePathSchema>;
