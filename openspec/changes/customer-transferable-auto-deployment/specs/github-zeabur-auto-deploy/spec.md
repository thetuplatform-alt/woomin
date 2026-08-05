## ADDED Requirements

### Requirement: Push-triggered customer deployment
The deployment workflow SHALL trigger on a push to the configured production branch and SHALL deploy only to the customer project and app service identified by repository configuration.

#### Scenario: Production branch receives a commit
- **WHEN** a commit is pushed to the configured production branch and required GitHub configuration exists
- **THEN** the workflow SHALL build and deploy that commit to the configured customer app service and SHALL pass its full commit SHA as `GIT_COMMIT_SHA`

##### Example: push deployment

- **GIVEN** commit abc123 is pushed to main and target service is s1
- **WHEN** the workflow runs
- **THEN** it deploys only s1 and passes GIT_COMMIT_SHA=abc123

#### Scenario: Workflow is manually dispatched
- **WHEN** an authorized repository user starts the workflow manually with a selected commit or branch
- **THEN** the workflow SHALL deploy only that selected revision to the configured customer target

##### Example: manual dispatch

- **GIVEN** an operator selects branch release/1.2
- **WHEN** workflow_dispatch starts
- **THEN** only the selected revision is deployed to the configured customer target

### Requirement: Deployment configuration and secret isolation
The workflow SHALL read the Zeabur deployment token from a GitHub Actions secret and SHALL read project, service, domain, and branch settings from non-secret repository variables or workflow inputs.

#### Scenario: Required configuration is complete
- **WHEN** `ZEABUR_TOKEN`, `ZEABUR_PROJECT_ID`, `ZEABUR_SERVICE_ID`, and `ZEABUR_DOMAIN` are available
- **THEN** the workflow SHALL use them without writing their values to tracked files or emitting token and application secret values in logs

##### Example: complete GitHub configuration

- **GIVEN** ZEABUR_TOKEN is a secret and project/service/domain are variables
- **WHEN** the workflow starts
- **THEN** it reads them from their configured scopes and logs only names and status

#### Scenario: Required configuration is incomplete
- **WHEN** any required deployment configuration is absent
- **THEN** the workflow SHALL fail before deployment and SHALL identify the missing configuration name without exposing secret contents

##### Example: missing token

- **GIVEN** ZEABUR_TOKEN is not configured
- **WHEN** workflow preflight runs
- **THEN** it exits before deployment and names ZEABUR_TOKEN as missing

### Requirement: Deployment result is auditable
The workflow SHALL expose the deployed commit, target service, deployment ID, and terminal result as workflow output.

#### Scenario: Deployment succeeds
- **WHEN** Zeabur reports a successful terminal deployment and post-deployment checks pass
- **THEN** the workflow SHALL report success with the customer target, deployment ID, and deployed full commit SHA

##### Example: auditable success

- **GIVEN** deployment d1 reaches RUNNING and version check returns abc123
- **WHEN** the workflow completes
- **THEN** output includes d1, target service s1, and abc123

#### Scenario: Deployment fails
- **WHEN** Zeabur reports a failed deployment or the command reaches its timeout
- **THEN** the workflow SHALL fail with the deployment stage and deployment ID when available, and SHALL retain the remote deployment for diagnosis

##### Example: auditable failure

- **GIVEN** deployment d2 crashes during runtime
- **WHEN** the workflow reaches terminal failure
- **THEN** it exits non-zero, reports d2 and runtime stage, and keeps d2 available for logs
