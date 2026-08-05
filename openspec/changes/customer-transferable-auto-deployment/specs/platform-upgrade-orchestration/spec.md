## ADDED Requirements

### Requirement: Upstream and customer origin separation
The upgrade workflow SHALL preserve the customer repository as `origin` and SHALL use a separate vendor repository as `upstream` for platform upgrades.

#### Scenario: Customer requests an upgrade
- **WHEN** the operator invokes `upgrade` with a vendor repository URL
- **THEN** the workflow SHALL fetch the vendor revision through `upstream`, create an upgrade branch, and preserve the current production commit for rollback

##### Example: upstream upgrade

- **GIVEN** origin points to customer/repo and upstream points to vendor/repo
- **WHEN** upgrade is requested for v2.0.0
- **THEN** branch upgrade/v2.0.0 is created and the current production SHA is recorded

#### Scenario: Vendor remote is unavailable
- **WHEN** the vendor repository cannot be fetched or the requested release cannot be resolved
- **THEN** the workflow SHALL stop before changing customer code or deployment resources and SHALL report the missing upstream revision

##### Example: missing vendor revision

- **GIVEN** upstream cannot resolve tag v2.0.0
- **WHEN** the upgrade fetch runs
- **THEN** no customer files or Zeabur resources change and the output names v2.0.0

### Requirement: Upgrade conflict and migration gate
The workflow SHALL produce a conflict report and migration risk report before merging or deploying an upgrade.

#### Scenario: Upgrade has no unresolved conflict
- **WHEN** the upgrade branch passes conflict detection, tests, Docker build validation, and migration dry-run
- **THEN** the workflow SHALL present the proposed commit and deployment target for confirmation before publishing or deploying

##### Example: clean upgrade gate

- **GIVEN** conflict count is 0, tests pass, and migration dry-run passes
- **WHEN** the upgrade gate completes
- **THEN** the workflow shows the candidate SHA and waits for confirmation

#### Scenario: Upgrade has unresolved conflict
- **WHEN** the customer branch conflicts with the vendor revision or migration validation fails
- **THEN** the workflow SHALL retain the upgrade branch, SHALL NOT merge or deploy it, and SHALL list the blocking files or migration failure stage

##### Example: unresolved conflict

- **GIVEN** files Dockerfile and prisma/schema.prisma conflict
- **WHEN** conflict detection runs
- **THEN** the branch is retained, merge is blocked, and both files are listed

### Requirement: Reversible platform upgrade
The upgrade workflow SHALL support rollback by redeploying the previously verified production commit without deleting the customer database or persistent volume.

#### Scenario: Upgrade deployment fails
- **WHEN** the new revision fails deployment or post-deployment health checks
- **THEN** the workflow SHALL retain the failed deployment ID and previous production commit, and SHALL provide a rollback deployment action

##### Example: failed upgrade deployment

- **GIVEN** candidate deployment d-new fails at runtime
- **WHEN** post-deployment health fails
- **THEN** d-new and the previous SHA are retained and rollback is offered

#### Scenario: Rollback is requested
- **WHEN** the operator confirms rollback to the previous verified commit
- **THEN** the workflow SHALL deploy that commit and SHALL verify its `/api/version` SHA before reporting recovery

##### Example: rollback verification

- **GIVEN** previous verified SHA is abc123
- **WHEN** rollback is confirmed
- **THEN** deployment runs abc123 and /api/version must return abc123
