import { z } from "zod";

const sessionFlag = z.string().regex(/^[\w./:#-]+$/);

export { sessionFlag };
