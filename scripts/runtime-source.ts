/** Unit-test source is authored beside modules but is not a runtime product. */
export const runtimeSourceRole = ({ file }: { readonly file: string }): "runtime" | "test" =>
  /\.test\.[cm]?[jt]sx?$/.test(file) ? "test" : "runtime";
