// Imported first (and only for its side effect) so .env is loaded before any
// other module evaluates — modules like db/index.ts read process.env at their
// own top level, and ES module imports are hoisted ahead of local statements.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — env vars may be supplied by the environment instead
}
