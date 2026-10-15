import projection from "./disciplines.eslint.mjs";
import copied from "../../../CD-14/cd14/cd14.eslint-plugin.ts?second-copy";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { plugins: { "rin-discipline": copied } },
];
