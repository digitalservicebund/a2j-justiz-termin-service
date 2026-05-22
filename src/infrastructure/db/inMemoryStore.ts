import type { Verfahren } from "@/domain/verfahren";
import type { VerfahrenRepository } from "@/domain/verfahrenRepository";

export class InMemoryStore implements VerfahrenRepository {
  private readonly cases = new Map<string, Verfahren>();
  private counter = 0;

  getById(id: string): Verfahren | null {
    return structuredClone(this.cases.get(id) ?? null);
  }

  save(c: Verfahren): void {
    this.cases.set(c.id, structuredClone(c));
  }

  deleteById(id: string): void {
    this.cases.delete(id);
  }

  deleteAll(): void {
    this.cases.clear();
  }

  nextId(prefix: string): string {
    return `${prefix}-${++this.counter}`;
  }
}
