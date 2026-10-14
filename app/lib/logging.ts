/* oxlint-disable no-console */
// Single place for log output, so a structured logger can replace it later.
export function logInfo(message: string): void {
  console.info(message);
}

export function logError(message: string, error?: unknown): void {
  console.error(message, error);
}
