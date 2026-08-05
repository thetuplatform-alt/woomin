## ADDED Requirements

### Requirement: Deployment package entrypoint

The repository SHALL provide a single deployment operations entrypoint that identifies the install, update, add-service, verification, rollback, and troubleshooting documents and states when an operator MUST stop for user action.

#### Scenario: New agent starts an installation

- **WHEN** an agent reads the deployment package entrypoint
- **THEN** it finds the ordered installation flow, required preflight, health gates, secret handling rules, and links to the detailed documents without relying on conversation history

#### Scenario: User authorization is required

- **WHEN** a workflow requires browser authorization, billing approval, third-party credentials, or an account choice
- **THEN** the package stops before the dependent mutation and reports the exact user action required

### Requirement: Preflight and account isolation

The deployment package SHALL perform read-only checks for CLI version, active account, target project, dedicated server readiness, ZeaburOS/k3s health, and existing resource state before creating or modifying services.

#### Scenario: Target account is wrong

- **WHEN** the active CLI account does not match the authorized target account
- **THEN** preflight exits non-zero, prints the account mismatch without printing tokens, and does not create or modify a resource

#### Scenario: Dedicated server is not ready

- **WHEN** a dedicated server is not online, not READY, or does not report HasK3s=true
- **THEN** preflight exits non-zero and reports the server ID and resume action without attempting manual k3s installation

#### Scenario: Preflight passes

- **WHEN** account, server, project, and existing-resource checks pass
- **THEN** preflight emits a non-secret summary containing the active account, server ID, project ID, and next permitted workflow step

### Requirement: Production service specification

The installation and add-service workflows SHALL create a production service from a verified image with an explicit HTTP/TCP port, required environment variable references, dependency order, and persistent volume specification before first production start.

#### Scenario: Image is promoted from a build carrier

- **WHEN** a build carrier image passes build and runtime checks
- **THEN** the production service specification references that image, exposes port 8080, mounts volume ID data at /data, and does not bind the production domain to the temporary carrier

#### Scenario: Required runtime dependency is missing

- **WHEN** startup logs report a missing module, script, Prisma asset, or runtime environment variable
- **THEN** the workflow marks the deployment failed, retains diagnostic resources, and prevents domain promotion

#### Scenario: Database dependency is unavailable

- **WHEN** PostgreSQL is not Running or DATABASE_URL is absent or empty
- **THEN** the application service is not promoted and the workflow reports db_deployed as the failed step

### Requirement: Health gates and persistence verification

The verification workflow SHALL test database migration, in-container HTTP, external HTTPS, version identity, pod readiness, volume mounting, restart persistence, and core scheduled routes as separate checks.

#### Scenario: Application is healthy

- **WHEN** migration has no pending changes, the container responds on 127.0.0.1:8080, the pod is 1/1 Running, and the external domain returns 2xx
- **THEN** the health summary marks the corresponding checks true and records the verified commit SHA

#### Scenario: Version identity is invalid

- **WHEN** /api/version returns unknown, fatal, an empty value, or a SHA different from the deployed source revision
- **THEN** version verification fails and the workflow does not mark the deployment complete

#### Scenario: Persistent volume survives restart

- **WHEN** a random marker is written under /data, the production service is restarted, and the marker is read again
- **THEN** the before and after checksums are identical and volume verification passes

#### Scenario: Optional provider is not configured

- **WHEN** an optional provider route returns a documented provider-not-configured result
- **THEN** the workflow records the provider as non-blocking while still requiring all core routes to return 2xx

### Requirement: Safe update and rollback

The update workflow SHALL preserve the current production service, database, volume, domain ownership, and rollback identifiers until the new deployment passes all required health gates.

#### Scenario: Update succeeds

- **WHEN** the new image passes build, runtime, external, persistence, and core-route checks
- **THEN** the workflow promotes the new image, removes only the stateless build carrier, and retains the production resources

#### Scenario: Update fails

- **WHEN** any required health gate fails
- **THEN** the workflow keeps the previous working deployment and emits failedStep, reason, resource IDs, retained resources, and resumeAction

#### Scenario: Domain cannot be assigned

- **WHEN** a requested generated or custom domain is unavailable
- **THEN** the workflow keeps the production app reachable through its current domain or fallback domain and does not delete the app, database, or volume

### Requirement: Secret and state-file protection

The deployment package SHALL keep API keys, passwords, database connection values, signing secrets, private keys, and third-party tokens out of repository files, logs, command output, and non-secret state.

#### Scenario: Secret variable is configured

- **WHEN** a secret is generated or supplied for a remote service
- **THEN** it is injected into the remote environment without echoing its value and verification reports only its key and presence

#### Scenario: State file is updated

- **WHEN** a resource ID, health check, failure, or resume action is recorded
- **THEN** the state file contains only non-secret identifiers and status fields and remains ignored by git

#### Scenario: Secret scan detects a value

- **WHEN** a preflight, verify, or git check detects a secret-shaped key or exact secret value in a tracked file
- **THEN** the check exits non-zero and blocks completion

### Requirement: Cron worker lifecycle

The deployment package SHALL install, configure, verify, and stop the scheduled worker with the same production URL and CRON_SECRET as the production app.

#### Scenario: Worker starts

- **WHEN** the worker is installed on the dedicated host
- **THEN** its systemd user service is enabled and active, its environment file is mode 600, and the worker uses the production HTTPS domain

#### Scenario: Core cron routes succeed

- **WHEN** the worker invokes course expiration, subscription maintenance, newsletter dispatch, assignment cleanup, and newsletter automation dispatch
- **THEN** each core route returns 2xx without 401 or 403

#### Scenario: Worker authentication fails

- **WHEN** any core route returns 401 or 403
- **THEN** cron verification fails and the workflow reports the account, URL, and secret wiring problem without exposing the secret value
