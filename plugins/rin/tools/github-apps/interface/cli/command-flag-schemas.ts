import { z } from "zod";

const issueOrPullNumberFlag = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number);

const sessionFlag = z.string().regex(/^[\w./:#-]+$/);

const bodyFlags = { body: z.string().optional(), "body-file": z.string().optional() };

const labelsFlag = z.array(z.string().min(1)).default([]);

const attachFlag = z.array(z.string().min(1)).default([]);

export { attachFlag, bodyFlags, labelsFlag, issueOrPullNumberFlag, sessionFlag };
