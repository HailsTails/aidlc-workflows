export type Arrivals = readonly string[];

export const NO_ARRIVALS: Arrivals = [];

export const isLaneAuthored =
  (arrivals: Arrivals) =>
  (path: string): boolean =>
    !arrivals.includes(path);
