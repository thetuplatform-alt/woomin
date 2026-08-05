## ADDED Requirements

### Requirement: Customer-owned deployment bootstrap
The delivery package SHALL allow a customer to initialize deployment using the customer's own GitHub repository and Zeabur workspace without requiring access to the vendor's local CLI session.

#### Scenario: Customer completes the preflight
- **WHEN** the customer runs the bootstrap command with the repository root and a Zeabur project target
- **THEN** the command SHALL verify required local tools, report the required GitHub secrets and variables, and exit with code 0 without creating a paid resource

##### Example: complete preflight

- **GIVEN** git, docker, Zeabur CLI, project p1, service s1, and domain app.zeabur.app are present
- **WHEN** bootstrap runs
- **THEN** it exits 0 and reports the required secret/variable names without creating a server

#### Scenario: Preflight has missing configuration
- **WHEN** a required tool, project ID, service ID, or domain is absent
- **THEN** the command SHALL exit non-zero and identify the missing field without printing any secret value

##### Example: missing service ID

- **GIVEN** project ID p1 is present but service ID is empty
- **WHEN** bootstrap runs
- **THEN** it exits non-zero and names ZEABUR_SERVICE_ID without printing DATABASE_URL

### Requirement: Customer-owned runtime resources
The onboarding documentation SHALL require a PostgreSQL service, an app service, a persistent volume mounted at `/data`, and runtime variables for database, URL, storage, and authentication configuration.

#### Scenario: Customer reviews the onboarding checklist
- **WHEN** the customer follows the documented first-deployment procedure
- **THEN** the checklist SHALL distinguish GitHub Actions secrets, GitHub repository variables, Zeabur build-time variables, and Zeabur runtime variables

##### Example: configuration ownership

- **GIVEN** a checklist row for ZEABUR_TOKEN
- **WHEN** the customer reviews the row
- **THEN** it is labeled GitHub Actions secret, while ZEABUR_PROJECT_ID is labeled repository variable

#### Scenario: Customer verifies persistent storage
- **WHEN** the customer completes the first deployment
- **THEN** the app service SHALL have `/data` mounted and `LOCAL_STORAGE_ROOT` SHALL point to `/data/uploads`

##### Example: storage verification

- **GIVEN** the production app is service s1
- **WHEN** the first deployment is verified
- **THEN** service s1 has a volume at /data and LOCAL_STORAGE_ROOT equals /data/uploads

### Requirement: No vendor-owned credentials in the delivery package
The delivery package SHALL contain no vendor Zeabur token, customer database connection string, customer secret, production domain, or customer resource ID as an operational default.

#### Scenario: Customer clones the delivery package
- **WHEN** the customer searches tracked files and example configuration
- **THEN** only placeholders and non-sensitive examples SHALL be present for credentials, domains, resource IDs, and connection strings

##### Example: customer clone scan

- **GIVEN** a customer clones the repository
- **WHEN** tracked files are scanned
- **THEN** they contain placeholders such as YOUR_ZEABUR_PROJECT_ID and no real token or connection string
