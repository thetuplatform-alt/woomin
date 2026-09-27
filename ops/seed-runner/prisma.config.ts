import { defineConfig } from "prisma/config";

// Client generation does not require a database URL. Runtime connectivity is
// provided exclusively through process.env.DATABASE_URL in lib/prisma.ts.
export default defineConfig({
  schema: "./prisma/schema.prisma",
});
