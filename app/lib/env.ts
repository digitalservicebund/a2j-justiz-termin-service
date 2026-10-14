// Non-secret config from the environment
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Local dev: run \`pnpm dev\` (loads .env.defaults). ` +
        `Deployed environments set this via their own configuration.`,
    );
  }
  return value;
}
