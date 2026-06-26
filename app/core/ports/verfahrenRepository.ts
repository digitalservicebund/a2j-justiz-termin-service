import type { Verfahren } from "../domain/verfahren";

export type VerfahrenRepository = {
  getById(id: string): Verfahren | null;
  save(v: Verfahren): void;
  deleteById(id: string): void;
  deleteAll(): void;
  nextId(prefix: string): string;
};
