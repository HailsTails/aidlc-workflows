export type Terminal = {
  write(text: string): void;
  writeError(text: string): void;
};