import type { ProjectedFile } from "../../domain/projected-file.ts";
import type { Rendering } from "./harness.ts";

export interface CapturedFileFrame {
  render(request: {
    readonly files: readonly ProjectedFile[];
    readonly render: (projectRoot: string) => Rendering;
  }): Promise<Rendering>;
}
