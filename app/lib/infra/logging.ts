/* oxlint-disable no-console */
// Single place for log output, so a structured logger can replace it later.
export function logInfo(message: string): void {
  console.info(message);
}

// Without an error, only the message: console.error would print "undefined" after it.
export function logError(message: string, error?: unknown): void {
  if (error === undefined) console.error(message);
  else console.error(message, error);
}
