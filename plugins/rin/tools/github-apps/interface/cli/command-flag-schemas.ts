import { z } from "zod";

const pullNumberFlag = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number);

const sessionFlag = z.string().regex(/^[\w./:#-]+$/);

const bodyFlags = { body: z.string().optional(), "body-file": z.string().optional() };

export { bodyFlags, pullNumberFlag, sessionFlag };
