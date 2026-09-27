// Safe default process for the temporary seed-only service. It does not read
// DATABASE_URL and never imports or executes the compiled seed.
process.title = "bestappstore-seed-runner-idle";
setInterval(() => {}, 2_147_483_647);
