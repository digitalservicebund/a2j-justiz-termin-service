import type { Verfahren } from "../domain/verfahren";

export interface VerfahrenRepository {
  getById(id: string): Verfahren | null;
  save(v: Verfahren): void;
  deleteById(id: string): void;
  deleteAll(): void;
  nextId(prefix: string): string;
}
