import type { Linter } from "eslint";
import { boundaryConfig } from "./lint/boundaries.ts";
import { INTERIM_READABILITY, readabilityConfig } from "./lint/readability.ts";
import { standardsConfig } from "./lint/standards.ts";

const config: Linter.Config[] = [
  ...standardsConfig,
  readabilityConfig(INTERIM_READABILITY),
  ...boundaryConfig,
];

export default config;
