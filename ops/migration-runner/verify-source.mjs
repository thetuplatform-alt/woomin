import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const runnerRoot = process.env.RUNNER_ROOT ?? process.cwd();
const migrationsRoot = process.env.MIGRATIONS_ROOT
  ? path.resolve(process.env.MIGRATIONS_ROOT)
  : path.join(runnerRoot, "prisma", "migrations");
const metadataPath = process.env.RUNNER_METADATA
  ? path.resolve(process.env.RUNNER_METADATA)
  : path.join(runnerRoot, "metadata.json");

const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

// Git stores these migration blobs with LF line endings. A Windows checkout may
// materialize the same committed bytes as CRLF, so restore LF before hashing.
// Reject bare CR bytes rather than silently canonicalizing unknown content.
const committedBlobBytes = (contents, relativePath) => {
  const bytes = [];

  for (let index = 0; index < contents.length; index += 1) {
    if (contents[index] !== 0x0d) {
      bytes.push(contents[index]);
      continue;
    }

    if (contents[index + 1] !== 0x0a) {
      throw new Error(`Unexpected bare CR byte in ${relativePath}`);
    }
  }

  return Buffer.from(bytes);
};

const migrationFiles = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(migrationsRoot, entry.name, "migration.sql"))
  .filter(existsSync)
  .sort((left, right) =>
    path
      .relative(migrationsRoot, left)
      .replaceAll("\\", "/")
      .localeCompare(
        path.relative(migrationsRoot, right).replaceAll("\\", "/"),
        "en",
      ),
  );

const rows = migrationFiles.map((filePath) => {
  const relativePath = path
    .relative(migrationsRoot, filePath)
    .replaceAll("\\", "/");
  const contents = committedBlobBytes(readFileSync(filePath), relativePath);

  return {
    relativePath,
    byteSize: contents.length,
    fileSha256: sha256(contents),
  };
});

const manifest = rows
  .map(
    ({ relativePath, byteSize, fileSha256 }) =>
      `${relativePath}\t${byteSize}\t${fileSha256}\n`,
  )
  .join("");

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const target = rows.find(({ relativePath }) =>
  relativePath.startsWith(`${metadata.targetMigration}/`),
);

if (rows.length !== metadata.migrationCount) {
  throw new Error(
    `Migration count mismatch: expected ${metadata.migrationCount}, got ${rows.length}`,
  );
}

if (!target || target.fileSha256 !== metadata.targetMigrationSha256) {
  throw new Error("Target migration checksum mismatch");
}

if (sha256(Buffer.from(manifest)) !== metadata.migrationManifestSha256) {
  throw new Error("Migration manifest checksum mismatch");
}

if (metadata.prismaVersion !== "7.2.0") {
  throw new Error("Unexpected Prisma version metadata");
}

console.log(`Verified ${rows.length} migrations and immutable checksums.`);
