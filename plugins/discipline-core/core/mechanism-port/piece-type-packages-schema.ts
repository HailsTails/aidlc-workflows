import { z } from "zod";

export const pieceTypePackagesSchema = z.array(z.string()).min(1).readonly();
