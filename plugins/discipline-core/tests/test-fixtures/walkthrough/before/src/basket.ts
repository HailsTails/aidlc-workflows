import { formatPence } from "./utils/format.ts";

type Line = { readonly name: string; readonly pence: number };

export class Basket {
  private readonly lines: Line[] = [];
  private openedAt = Date.now();

  add(entry: unknown): void {
    this.lines.push(entry as Line);
  }

  total(): string {
    let pence = 0;
    for (const line of this.lines) {
      pence += line.pence;
    }
    return formatPence({ pence });
  }

  ageInMilliseconds(): number {
    return Date.now() - this.openedAt;
  }
}
