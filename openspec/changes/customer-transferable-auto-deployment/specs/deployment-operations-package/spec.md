## ADDED Requirements

### Requirement: Deployment package entrypoint

The delivery package SHALL provide one agent and operator entrypoint that identifies install, update, add-service, verification, rollback, and troubleshooting documents and states when the workflow MUST stop for user action.

#### Scenario: New agent starts an installation

- **WHEN** an agent reads the deployment package entrypoint
- **THEN** it finds the ordered installation flow, preflight, health gates, secret rules, and detailed document links without conversation history

##### Example: installation entrypoint

- **GIVEN** docs/deployment/AGENT.md is the only file opened
- **WHEN** the agent selects install
- **THEN** it reaches preflight.md before any Zeabur mutation

#### Scenario: User authorization is required

- **WHEN** browser authorization, billing approval, third-party credentials, or an account choice is required
- **THEN** the workflow stops before the dependent mutation and reports the exact user action

##### Example: browser authorization

- **GIVEN** Zeabur login requires a browser approval
- **WHEN** the login command opens the browser
- **THEN** the workflow pauses and reports “approve Zeabur login” without creating a project

### Requirement: Preflight and account isolation

The package SHALL perform read-only checks for CLI version, active account, target project, dedicated server readiness, ZeaburOS/k3s health, and existing resource state before remote mutation.

#### Scenario: Target account is wrong

- **WHEN** the active CLI account does not match the authorized target account
- **THEN** preflight exits non-zero, reports the mismatch without tokens, and creates or modifies no resource

##### Example: account mismatch

- **GIVEN** active account is vendor-demo and target account is customer-prod
- **WHEN** preflight compares the usernames
- **THEN** exit code is non-zero and the output names both usernames without a token

#### Scenario: Dedicated server is not ready

- **WHEN** a dedicated server is offline, not READY, or HasK3s is false
- **THEN** preflight exits non-zero and reports the server ID and resume action without manually installing k3s

##### Example: missing k3s

- **GIVEN** server status is RUNNING and HasK3s=false
- **WHEN** preflight checks managed runtime readiness
- **THEN** it reports the server ID and stops before project creation

### Requirement: Production service specification

The installation and add-service workflows SHALL create a production service from a verified image with an explicit port, required variable references, dependency order, and persistent volume before first production start.

#### Scenario: Image is promoted from a build carrier

- **WHEN** a build carrier image passes build and runtime checks
- **THEN** the production specification references that image, exposes TCP 8080, mounts volume ID data at /data, and does not bind the production domain to the carrier

##### Example: image promotion

- **GIVEN** image digest sha256:abc passes runtime checks
- **WHEN** the production template is created
- **THEN** its image is sha256:abc, port is 8080, volume is data:/data, and carrier domains are empty

#### Scenario: Runtime dependency is missing

- **WHEN** startup logs report a missing module, script, Prisma asset, or runtime variable
- **THEN** promotion fails, diagnostic resources remain, and domain promotion is blocked

##### Example: missing zod

- **GIVEN** startup reports Cannot find module zod
- **WHEN** promotion evaluates runtime logs
- **THEN** the image is rejected and the temporary deployment remains for diagnosis

### Requirement: Health gates and persistence verification

The verification workflow SHALL independently test migration, in-container HTTP, external HTTPS, version identity, pod readiness, volume mounting, restart persistence, and core scheduled routes.

#### Scenario: Application is healthy

- **WHEN** migration is complete, 127.0.0.1:8080 responds, the pod is 1/1 Running, and the external domain returns 2xx
- **THEN** the health summary marks the checks true and records the verified commit SHA

##### Example: healthy deployment

- **GIVEN** migration has no pending changes, pod is 1/1, and home returns 200
- **WHEN** verify runs for commit abc123
- **THEN** internalHttpVerified, externalHttpVerified, and versionVerified are true for abc123

#### Scenario: Version identity is invalid

- **WHEN** /api/version returns unknown, fatal, empty, or a SHA different from the source revision
- **THEN** version verification fails and completion is not reported

##### Example: unknown version

- **GIVEN** /api/version returns {"commit":"unknown"}
- **WHEN** verify expects abc123
- **THEN** versionVerified is false and completion remains blocked

#### Scenario: Persistent volume survives restart

- **WHEN** a random marker is written under /data, the production service restarts, and the marker is read again
- **THEN** before and after checksums match and volume verification passes

##### Example: restart marker

- **GIVEN** /data/.deployment-marker checksum is 9f2a before restart
- **WHEN** the app restarts and the marker is read
- **THEN** checksum is 9f2a after restart and volumeVerified is true

### Requirement: Safe update and rollback

The update workflow SHALL preserve the current production service, database, volume, domain ownership, and rollback identifiers until the new deployment passes all required health gates.

#### Scenario: Update fails

- **WHEN** any required health gate fails
- **THEN** the previous working deployment remains available and the output contains failedStep, reason, resource IDs, retained resources, and resumeAction

##### Example: failed health gate

- **GIVEN** deployment d-new returns 503 while d-old is healthy
- **WHEN** update verification fails
- **THEN** d-old remains active and output includes failedStep=external_http

#### Scenario: Domain cannot be assigned

- **WHEN** a generated or custom domain is unavailable
- **THEN** the workflow preserves the app, database, and volume and reports a safe fallback or user action

##### Example: unavailable domain

- **GIVEN** the requested domain is unavailable
- **WHEN** domain creation returns DOMAIN_UNAVAILABLE
- **THEN** database and volume remain untouched and the output requests a new domain choice

### Requirement: Secret and state-file protection

The package SHALL keep API keys, passwords, database connection values, signing secrets, private keys, and third-party tokens out of repository files, logs, command output, and non-secret state.

#### Scenario: Secret variable is configured

- **WHEN** a secret is generated or supplied for a remote service
- **THEN** it is injected without echoing its value and verification reports only its key and presence

##### Example: secret variable

- **GIVEN** CRON_SECRET is generated for the app
- **WHEN** the variable is created
- **THEN** logs show CRON_SECRET present but never show its value

#### Scenario: State file is updated

- **WHEN** a resource ID, health check, failure, or resume action is recorded
- **THEN** the state file contains only non-secret identifiers and status fields and remains ignored by git

##### Example: resumable state

- **GIVEN** projectId p1 and failedStep image_building are recorded
- **WHEN** git check-ignore checks the state path
- **THEN** the file is ignored and contains no DATABASE_URL value

### Requirement: Cron worker lifecycle

The package SHALL install, configure, verify, and stop the scheduled worker with the same production URL and CRON_SECRET as the production app.

#### Scenario: Core cron routes succeed

- **WHEN** course expiration, subscription maintenance, newsletter dispatch, assignment cleanup, and newsletter automation dispatch run
- **THEN** each core route returns 2xx without 401 or 403

##### Example: core cron matrix

- **GIVEN** five core routes return 200
- **WHEN** cron verification runs
- **THEN** cronVerified is true and no route is classified as authentication failure

#### Scenario: Optional provider is not configured

- **WHEN** an optional provider route returns a documented provider-not-configured result
- **THEN** the workflow records the provider as non-blocking while requiring all core routes to pass

##### Example: optional Cloudflare provider

- **GIVEN** cloudflare-stream-sync returns provider-not-configured
- **WHEN** the other five routes return 200
- **THEN** cronVerified remains true and the optional provider is listed as non-blocking
