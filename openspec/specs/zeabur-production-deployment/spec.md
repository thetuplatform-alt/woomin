# zeabur-production-deployment Specification

## Purpose

TBD - created by archiving change 'deploy-thetu-platform-to-zeabur'. Update Purpose after archive.

## Requirements

### Requirement: Target account isolation
The deployment workflow MUST switch the global Zeabur CLI to the API key account stored in the local `.env` file, SHALL proceed only when the authenticated username is exactly `thetuplatform-alt`, and SHALL restore the `fish` CLI login through browser authorization after deployment. This global switch is explicitly authorized because Zeabur CLI v0.21.0 does not honor `XDG_CONFIG_HOME`.

#### Scenario: Correct API key account
- **WHEN** the workflow authenticates with the local API key and the CLI reports username `thetuplatform-alt`
- **THEN** the workflow SHALL query and mutate deployment resources through that target-account session and SHALL unset the shell token immediately after login

#### Scenario: Unexpected API key account
- **WHEN** the authenticated username differs from `thetuplatform-alt`
- **THEN** the workflow MUST stop before renting a server or creating any project resource

#### Scenario: Original CLI account is restored
- **WHEN** deployment work reaches terminal success
- **THEN** the workflow SHALL log out `thetuplatform-alt`, launch browser authorization, and mark account restoration complete only after `auth status` reports username `fish`


<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->

---
### Requirement: Confirmed dedicated server provisioning
The deployment workflow SHALL reuse server `6a69de894ac7e3522bbc12f0`, which is the single Tencent Cloud Tokyo server created with provider `TENCENT`, region `ap-tokyo`, and plan `bundle_starter_nmc_lin_med8_01`. The workflow MUST NOT invoke server rental again.

#### Scenario: No resumable server exists
- **WHEN** the target account has no live server recorded by this deployment
- **THEN** the workflow MUST stop and request explicit direction because the already-paid server is expected to exist; it MUST NOT silently rent a replacement

##### Example: Recorded server is unexpectedly missing
- **GIVEN** `.realms-deploy.json` records server `6a69de894ac7e3522bbc12f0`
- **WHEN** the target account server list does not contain that ID
- **THEN** the workflow stops with `failedStep: server_ready`, reports monthly cost reconciliation as required, and does not call `server rent`

#### Scenario: Provisioning is resumed
- **WHEN** `.realms-deploy.json` contains server ID `6a69de894ac7e3522bbc12f0` and the remote server still exists with the confirmed specification
- **THEN** the workflow SHALL reuse that server, MUST NOT rent a duplicate, and SHALL wait for `ProvisioningStatus=READY`, `VMStatus=RUNNING`, `HasK3s=true`, and a `Server initialized` event before deploying project services

#### Scenario: Managed runtime initialization is incomplete
- **WHEN** the server VM is `RUNNING` but `HasK3s=false` or the latest initialization event remains `Validating server hardware`
- **THEN** the workflow MUST retain the server, MUST NOT deploy PostgreSQL or application services, MUST NOT install K3s manually, and SHALL preserve a resume action that rechecks the same server

#### Scenario: Payment or provisioning fails
- **WHEN** Zeabur rejects payment or the server fails to reach `RUNNING`
- **THEN** the workflow MUST stop before creating project services and SHALL report whether a recurring-cost server was created


<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->

---
### Requirement: Isolated project and database
The workflow SHALL create a dedicated Zeabur project on the confirmed server and SHALL deploy a PostgreSQL service whose private connection value is supplied to the production application as `DATABASE_URL`.

#### Scenario: Database becomes ready
- **WHEN** the project exists and polling observes a successful latest deployment, an available PostgreSQL service, and a non-empty exported `DATABASE_URL` within 10 minutes
- **THEN** the workflow SHALL record the project and database service identifiers and continue to image build

##### Example: Database ready on the twelfth poll
- **GIVEN** polling starts at `12:00:00Z` with a 15-second interval
- **WHEN** poll 12 at `12:02:45Z` reports deployment success, service availability, and a non-empty `DATABASE_URL`
- **THEN** the database gate passes and image build starts

#### Scenario: Database is unavailable
- **WHEN** PostgreSQL reports a terminal deployment failure or still lacks any required readiness signal after 10 minutes of 15-second polling
- **THEN** the workflow MUST stop before creating the production application service and SHALL record `failedStep` as `db_deployed`

##### Example: Database readiness timeout
- **GIVEN** polling starts at `12:00:00Z`
- **WHEN** the final poll at or after `12:10:00Z` still lacks a non-empty `DATABASE_URL`
- **THEN** the workflow stops without creating a production application service


<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->

---
### Requirement: Production image and persistent storage
The workflow SHALL build the repository Dockerfile through a temporary build carrier and SHALL create the production application from the resulting OCI image with TCP port 8080 and a persistent volume mounted at `/data` in the initial service specification.

#### Scenario: Production service is created with storage
- **WHEN** the build carrier produces a successful image and the production service is created
- **THEN** the production service specification SHALL include a persistent volume at `/data` before its first start

#### Scenario: Volume evidence is missing
- **WHEN** either the platform volume configuration or the running container fails to prove that `/data` is mounted
- **THEN** the workflow MUST NOT designate the service as production, bind the final domain, or claim deployment completion

#### Scenario: Storage persists across restart
- **WHEN** a marker file is written under `/data` and the production service is restarted
- **THEN** the marker file SHALL remain readable with the same content after restart


<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->

---
### Requirement: Secure production configuration
The workflow SHALL generate distinct cryptographically secure values for `AUTH_SECRET`, `NEWSLETTER_UNSUBSCRIBE_SECRET`, and `CRON_SECRET`, SHALL set `LOCAL_STORAGE_ROOT` to `/data/uploads`, and SHALL configure `APP_URL` and `NEXT_PUBLIC_APP_URL` to the same final HTTPS URL for both build-time and runtime use.

#### Scenario: Required variables are applied
- **WHEN** the production service starts
- **THEN** `DATABASE_URL`, `AUTH_SECRET`, `NEWSLETTER_UNSUBSCRIBE_SECRET`, `CRON_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, and `LOCAL_STORAGE_ROOT` SHALL be present without their secret values appearing in local state, Git diffs, or user-visible command output

##### Example: Variable scope matrix
| Variable | Build-time | Runtime | Expected value rule |
| ----- | ----- | ----- | ----- |
| `DATABASE_URL` | no | yes | non-empty private PostgreSQL value |
| `AUTH_SECRET` | no | yes | at least 32 random bytes |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | no | yes | distinct, at least 32 random bytes |
| `CRON_SECRET` | no | yes | distinct, at least 32 random bytes |
| `APP_URL` | yes | yes | final HTTPS URL without trailing slash |
| `NEXT_PUBLIC_APP_URL` | yes | yes | exactly equals `APP_URL` |
| `LOCAL_STORAGE_ROOT` | no | yes | `/data/uploads` |

#### Scenario: Public URL differs from build configuration
- **WHEN** the final bound HTTPS URL does not equal both configured public URL variables
- **THEN** the workflow MUST update both build-time URL variables and rebuild the image before external acceptance; changing runtime variables alone MUST NOT pass

##### Example: Runtime-only correction is rejected
- **GIVEN** the image was built with `https://thetu-course.zeabur.app`
- **WHEN** the final domain is `https://thetu-platform.zeabur.app`
- **THEN** both URL variables are changed to the final domain and a new image is built before acceptance


<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->

---
### Requirement: Database migration and application health
The production deployment SHALL complete Prisma migration successfully and SHALL pass internal port, external HTTPS, and version checks before it is marked complete.

#### Scenario: All health gates pass
- **WHEN** migration succeeds, `http://127.0.0.1:8080` responds inside the service, the public HTTPS URL responds, and `/api/version` returns the deployed Git commit SHA
- **THEN** the workflow SHALL record all associated check flags as true

#### Scenario: A health gate fails
- **WHEN** any migration, internal HTTP, external HTTPS, or version check fails
- **THEN** the workflow MUST preserve diagnostic resources, MUST NOT mark the deployment `done`, and SHALL report the failed gate


<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->

---
### Requirement: Scheduled worker activation
The deployment SHALL install the repository cron worker on the confirmed dedicated server with the final application URL and the same `CRON_SECRET` supplied to the application.

#### Scenario: Worker is healthy
- **WHEN** the worker process is running and an authenticated cron request succeeds
- **THEN** the workflow SHALL record `cronVerified` as true

#### Scenario: Worker cannot be activated
- **WHEN** the worker service is not `active`, any of the five core routes fails to return 2xx during a 75-second verification window, or any route returns 401 or 403
- **THEN** the workflow MUST NOT mark the overall deployment complete; an explicit Cloudflare provider-not-configured response from `cloudflare-stream-sync` SHALL NOT fail this gate when Cloudflare Stream is out of scope

##### Example: Optional Cloudflare route is disabled
- **GIVEN** the five core routes each return 2xx and `cloudflare-stream-sync` returns a provider-not-configured error
- **WHEN** Cloudflare Stream is not configured for this deployment
- **THEN** `cronVerified` becomes true because the worker and all in-scope routes are healthy


<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->

---
### Requirement: Durable non-secret deployment state
The workflow SHALL maintain `.realms-deploy.json` as a resumable non-secret checkpoint and SHALL ensure Git ignores that file before storing any remote resource identifier.

#### Scenario: A deployment step completes
- **WHEN** a server, project, database, build carrier, production app, domain, or verification gate completes
- **THEN** the workflow SHALL update the corresponding state field and RFC3339 `updatedAt` timestamp

#### Scenario: State file is inspected for secrets
- **WHEN** the state file and Git diff are reviewed
- **THEN** exact-value scanning and forbidden-key scanning MUST find no API key, database password, connection string, generated secret, or keys named `api_key`, `DATABASE_URL`, `AUTH_SECRET`, `NEWSLETTER_UNSUBSCRIBE_SECRET`, or `CRON_SECRET`

##### Example: Forbidden state field
- **GIVEN** `.realms-deploy.json` contains a property named `CRON_SECRET`
- **WHEN** the non-secret state validation runs
- **THEN** validation fails without printing the property's value


<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->

---
### Requirement: Safe cleanup and cost reporting
The workflow SHALL explicitly report any paid or persistent resources that remain after failure and, after terminal deployment success, SHALL log out `thetuplatform-alt` and restore the `fish` CLI account through browser authorization.

#### Scenario: Deployment succeeds
- **WHEN** all acceptance gates pass
- **THEN** the workflow SHALL remove the temporary build carrier, retain the production server, database, app, volume, and domain, log out `thetuplatform-alt`, and restore `fish` before marking account cleanup complete

##### Example: Final successful state
- **GIVEN** every field under `checks` is `true` and `step` is ready to advance from `cron_verified`
- **WHEN** build carrier removal succeeds and `auth status` reports `fish` after browser authorization
- **THEN** `step` becomes `done` while production resource identifiers remain recorded

#### Scenario: Deployment pauses after server rental
- **WHEN** a later deployment stage fails after the server has been rented
- **THEN** the workflow SHALL retain recoverable state, MUST NOT delete the server, database, or volume without explicit user authorization, and SHALL report `failedStep`, `reason`, resource identifiers, domain, `recurringCostUSD: 6`, `resourcesRetained`, and `resumeAction`

##### Example: Build failure after database creation
- **GIVEN** the server, project, and PostgreSQL exist but the build carrier fails
- **WHEN** the workflow pauses at `failedStep: app_deployed`
- **THEN** the report includes all retained resource IDs, monthly cost US$6, and a resume action that restarts from image build without renting another server

<!-- @trace
source: deploy-thetu-platform-to-zeabur
updated: 2026-07-30
code:
  - .opencode/commands/spectra-archive.md
  - .opencode/commands/spectra-discuss.md
  - .opencode/commands/spectra-apply.md
  - .spectra.yaml
  - .opencode/commands/spectra-commit.md
  - GEMINI.md
  - .github/skills/spectra-drift/SKILL.md
  - .opencode/commands/spectra-audit.md
  - .opencode/commands/spectra-debug.md
  - docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
  - .opencode/skills/spectra-propose/SKILL.md
  - .opencode/skills/spectra-debug/SKILL.md
  - .opencode/commands/spectra-propose.md
  - .opencode/skills/spectra-ask/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .opencode/commands/spectra-ask.md
  - .github/skills/spectra-discuss/SKILL.md
  - .opencode/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .opencode/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .opencode/skills/spectra-commit/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .cursorrules
  - .opencode/commands/spectra-drift.md
  - .opencode/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .github/skills/spectra-ask/SKILL.md
  - .opencode/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .opencode/commands/spectra-ingest.md
  - .github/skills/spectra-propose/SKILL.md
  - CLAUDE.md
  - .github/skills/spectra-archive/SKILL.md
  - .opencode/skills/spectra-audit/SKILL.md
  - Dockerfile
  - AGENTS.md
-->