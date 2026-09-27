import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const runnerRoot = process.env.RUNNER_ROOT ?? process.cwd();
const sourceRoot = process.env.SOURCE_ROOT
  ? path.resolve(process.env.SOURCE_ROOT)
  : runnerRoot;
const readFromRunner = (relativePath) =>
  readFileSync(path.join(runnerRoot, relativePath));
const readFromSource = (relativePath) =>
  readFileSync(path.join(sourceRoot, relativePath));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Git committed text blobs use LF. Normalize only CRLF and reject bare CR so
// Windows checkout behavior cannot change the verified source identity.
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

const gitBlobId = (contents) =>
  createHash("sha1")
    .update(Buffer.from(`blob ${contents.length}\0`))
    .update(contents)
    .digest("hex");

const metadata = JSON.parse(readFromRunner("metadata.json").toString("utf8"));
const packageJson = JSON.parse(readFromRunner("package.json").toString("utf8"));

const sourceFiles = [
  ["scripts/seed-bestappstore.ts", "seedBestAppStoreBlob"],
  ["lib/lumi-seed-data.ts", "lumiSeedDataBlob"],
  ["prisma/schema.prisma", "prismaSchemaBlob"],
  ["lib/prisma.ts", "prismaModuleBlob"],
];

const committedSources = new Map();
for (const [relativePath, metadataKey] of sourceFiles) {
  const contents = committedBlobBytes(readFromSource(relativePath), relativePath);
  committedSources.set(relativePath, contents);

  if (gitBlobId(contents) !== metadata[metadataKey]) {
    throw new Error(`Git blob mismatch for ${relativePath}`);
  }
}

if (metadata.applicationSourceCommit !== "0e3187bc8fd8507e827919ea39d30b7d3d7e0c89") {
  throw new Error("Unexpected application source commit metadata");
}

const seedSource = committedSources
  .get("scripts/seed-bestappstore.ts")
  .toString("utf8");
const allowedSeedImports = [
  "../lib/prisma",
  "../lib/lumi-seed-data",
];
const seedImports = [...seedSource.matchAll(/from\s+['"]([^'"]+)['"]/g)]
  .map((match) => match[1])
  .sort();

if (JSON.stringify(seedImports) !== JSON.stringify(allowedSeedImports.sort())) {
  throw new Error("Unexpected seed import tree");
}

const seedDataSource = committedSources
  .get("lib/lumi-seed-data.ts")
  .toString("utf8");
const toolSeedStart = seedDataSource.indexOf("export const LUMI_TOOL_SEEDS");
if (toolSeedStart < 0) {
  throw new Error("LUMI_TOOL_SEEDS export not found");
}

const toolSeedSource = seedDataSource.slice(toolSeedStart);
const toolSlugs = [...toolSeedSource.matchAll(/slug:\s*'([^']+)'/g)]
  .map((match) => match[1])
  .sort();
const uniqueToolSlugs = [...new Set(toolSlugs)];
const slugManifest = uniqueToolSlugs.map((slug) => `${slug}\n`).join("");

if (toolSlugs.length !== uniqueToolSlugs.length) {
  throw new Error("Duplicate Tool slug in seed source");
}

if (JSON.stringify(uniqueToolSlugs) !== JSON.stringify(metadata.expectedToolSlugs)) {
  throw new Error("Tool slug set mismatch");
}

if (sha256(Buffer.from(slugManifest)) !== metadata.toolSlugManifestSha256) {
  throw new Error("Tool slug manifest checksum mismatch");
}

const webAppCount = (toolSeedSource.match(/type:\s*'WEB_APP'/g) ?? []).length;
const skillCount = (toolSeedSource.match(/type:\s*'SKILL'/g) ?? []).length;

if (
  metadata.expectedSeriesCount !== 1 ||
  metadata.expectedEntitlementCount !== 1 ||
  metadata.expectedToolCount !== uniqueToolSlugs.length ||
  metadata.expectedUserEntitlementCount !== 0 ||
  metadata.expectedWebAppCount !== webAppCount ||
  metadata.expectedSkillCount !== skillCount
) {
  throw new Error("Expected seed counts mismatch");
}

const expectedPins = {
  "@prisma/adapter-pg": metadata.prismaAdapterPgVersion,
  "@prisma/client": metadata.prismaVersion,
  pg: metadata.pgVersion,
};
for (const [name, version] of Object.entries(expectedPins)) {
  if (packageJson.dependencies?.[name] !== version) {
    throw new Error(`Unexpected ${name} version`);
  }
}

if (
  packageJson.devDependencies?.prisma !== metadata.prismaVersion ||
  packageJson.devDependencies?.typescript !== metadata.typescriptVersion ||
  packageJson.engines?.node !== metadata.nodeVersion
) {
  throw new Error("Unexpected build/runtime pin");
}

for (const contents of committedSources.values()) {
  const sourceText = contents.toString("utf8");
  if (/dotenv|\.env\.local|migrate\s+(deploy|resolve)|db\s+push/i.test(sourceText)) {
    throw new Error("Forbidden env or migration behavior in seed source");
  }
}

console.log(
  `Verified immutable seed sources, ${uniqueToolSlugs.length} Tool slugs, ` +
    `${webAppCount} Web Apps, and ${skillCount} Skills.`,
);
