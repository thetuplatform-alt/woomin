## ADDED Requirements

### Requirement: Repository URL intake
The platform operations skill SHALL accept a GitHub repository URL and SHALL identify the local checkout, origin, branch, current commit, and available deployment contract before mutating external state.

#### Scenario: GitHub repository is supplied
- **WHEN** the operator invokes the skill with a reachable repository URL and `install`, `update`, `upgrade`, or `troubleshoot`
- **THEN** the skill SHALL print the selected repository, branch, commit, target operation, and planned next stage before any external mutation

##### Example: reachable repository

- **GIVEN** repository URL https://github.com/customer/course and operation update
- **WHEN** intake completes
- **THEN** output names the URL, branch main, current SHA, target operation update, and next stage preflight

#### Scenario: Repository cannot be reached
- **WHEN** the supplied URL is invalid, inaccessible, or lacks a usable checkout
- **THEN** the skill SHALL stop with a non-zero result and identify the repository access failure without attempting Zeabur changes

##### Example: inaccessible repository

- **GIVEN** the supplied repository returns 404
- **WHEN** intake attempts checkout
- **THEN** it exits non-zero and performs no Zeabur mutation

### Requirement: Legacy no-Git intake
The skill SHALL support a local application directory without Git by preserving its worktree, initializing Git, and creating or attaching a GitHub remote through an explicit confirmation boundary.

#### Scenario: Local directory has no Git
- **WHEN** the operator selects `install` for a local directory without `.git`
- **THEN** the skill SHALL create a local Git repository, record the initial commit, and report the remote publication action before pushing existing code

##### Example: legacy directory

- **GIVEN** /workspace/course has no .git directory
- **WHEN** install intake runs
- **THEN** it creates an initial commit and reports the planned GitHub push before publishing

#### Scenario: Requested remote is non-empty
- **WHEN** the selected GitHub remote already contains commits that are not present locally
- **THEN** the skill SHALL stop before overwriting or force-pushing and SHALL report the required reconciliation action

##### Example: non-empty remote

- **GIVEN** the remote contains commit remote789 not in the local branch
- **WHEN** intake compares histories
- **THEN** it stops before push and reports reconciliation with remote789

### Requirement: Operation routing
The skill SHALL route `install`, `update`, `upgrade`, and `troubleshoot` to distinct contracts and SHALL show the current stage and next action.

#### Scenario: Operator selects a supported operation
- **WHEN** the operator supplies one supported operation
- **THEN** the skill SHALL execute only that operation contract and SHALL preserve a resumable non-secret checkpoint

##### Example: update routing

- **GIVEN** operation update and target service s1
- **WHEN** routing runs
- **THEN** only the update contract executes and its checkpoint contains s1 without secrets

#### Scenario: Operator supplies an unsupported operation
- **WHEN** the operator supplies an operation outside the supported set
- **THEN** the skill SHALL stop before external mutation and SHALL list the supported operations

##### Example: unsupported operation

- **GIVEN** operation publish-now
- **WHEN** routing validates the operation
- **THEN** it exits before mutation and lists install, update, upgrade, and troubleshoot
