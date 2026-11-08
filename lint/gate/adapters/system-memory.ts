import { freemem } from "node:os";
import type { FreeMemory } from "../application/ports.ts";

export const systemMemory: FreeMemory = { bytes: () => freemem() };
