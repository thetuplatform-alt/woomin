## ADDED Requirements

### Requirement: Post-deployment health verification
A successful deployment SHALL require an HTTP 200 response from the public home page and `/api/version`, and `/api/version` SHALL identify the exact Git commit deployed by the workflow.

#### Scenario: Version and home checks pass
- **WHEN** the deployment reaches a successful terminal state
- **THEN** the verification command SHALL receive HTTP 200 from both endpoints and SHALL confirm that the version SHA equals the workflow commit SHA

##### Example: successful health check

- **GIVEN** workflow commit is abc123
- **WHEN** home and /api/version both return 200 and version returns abc123
- **THEN** verification exits 0

#### Scenario: Health check fails
- **WHEN** either endpoint is unavailable, returns a non-2xx response, or returns a different SHA
- **THEN** the workflow SHALL exit non-zero and SHALL identify the failed endpoint and expected SHA without claiming production success

##### Example: SHA mismatch

- **GIVEN** expected SHA is abc123 and /api/version returns old456
- **WHEN** verification compares the values
- **THEN** it exits non-zero and identifies /api/version as failed

### Requirement: Safe retry and rollback
The recovery procedure SHALL support rerunning a failed deployment or deploying a reverted Git commit without deleting the customer's PostgreSQL service or persistent volume.

#### Scenario: Failed deployment is retried
- **WHEN** the customer reruns the workflow after correcting configuration or code
- **THEN** the workflow SHALL create or update only the app deployment and SHALL preserve the existing database and volume

##### Example: safe retry

- **GIVEN** app deployment d1 failed because a variable was missing
- **WHEN** the customer reruns after fixing the variable
- **THEN** only the app deployment changes and database/volume IDs remain unchanged

#### Scenario: Customer rolls back a release
- **WHEN** the customer reverts the production branch to a previously verified commit and runs deployment
- **THEN** the workflow SHALL deploy the reverted revision and SHALL verify its version SHA through `/api/version`

##### Example: release rollback

- **GIVEN** production branch is reverted from new789 to old456
- **WHEN** deployment runs
- **THEN** /api/version returns old456 before recovery is reported

### Requirement: Actionable failure output
Failure output SHALL identify the failed stage, target service, deployment ID when available, and a safe next action.

#### Scenario: Configuration failure occurs
- **WHEN** a required secret, variable, or endpoint is missing
- **THEN** the output SHALL identify the missing non-secret name and instruct the customer to correct repository or Zeabur configuration

##### Example: missing configuration

- **GIVEN** ZEABUR_SERVICE_ID is absent
- **WHEN** workflow preflight runs
- **THEN** it exits non-zero and names ZEABUR_SERVICE_ID without printing a token

#### Scenario: Runtime deployment failure occurs
- **WHEN** the Zeabur container fails to start or migration fails
- **THEN** the output SHALL point the customer to the Zeabur deployment logs and SHALL instruct the customer to rerun or revert without deleting persistent resources

##### Example: migration failure

- **GIVEN** the container exits during Prisma migration
- **WHEN** runtime diagnosis runs
- **THEN** output names the deployment logs and preserves PostgreSQL and the volume
