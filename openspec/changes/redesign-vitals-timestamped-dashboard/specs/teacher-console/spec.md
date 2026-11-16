# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Teacher-wide read-only patient access`
- TO: `### Requirement: Teacher reads every patient`

## MODIFIED Requirements

### Requirement: Teacher reads every patient
The teacher SHALL open the workspace of every fictional patient and read the Dashboard, the saved measurement entries and the care reports; adding, changing or deleting measurement entries or care reports SHALL NOT be offered to the teacher role.

#### Scenario: Review any patient
- **WHEN** the teacher opens patient 7's workspace
- **THEN** the Dashboard, the entry lists and the care reports for patient 7 are shown

#### Scenario: No data-entry controls
- **WHEN** the teacher views a patient's Vitalwerte tab or Pflegebericht tab
- **THEN** no input form, save button or delete control for entries or reports is shown

### Requirement: Teacher-only routes
The teacher console, the patient-details API and the class-data reset SHALL require a teacher session and SHALL return HTTP 401 to a request without one.

#### Scenario: Anonymous visitor opens the console
- **WHEN** a request without a teacher session asks for the teacher console or its API
- **THEN** the system returns HTTP 401 and shows no class data

#### Scenario: Anonymous visitor changes a patient
- **WHEN** a request without a teacher session tries to change a patient's name or date of birth
- **THEN** the system returns HTTP 401 and the patient is unchanged

### Requirement: Class roster baseline
The seeded data SHALL contain exactly ten fictional patients with stable opaque identifiers and no stored date of birth; re-running the seed SHALL NOT duplicate patients or overwrite details the teacher has changed.

#### Scenario: Idempotent seed
- **WHEN** the seed runs twice
- **THEN** there are still exactly ten patients, each with the same identifier as after the first run

#### Scenario: Seed keeps teacher edits
- **WHEN** the teacher renamed patient 3 and the seed runs again
- **THEN** patient 3 keeps the new name

### Requirement: Class-data reset
A reset operation SHALL remove all measurement entries, care reports, revisions and audit entries across the ten patients while keeping the patients with their current names and dates of birth; it SHALL require an explicit confirmation and SHALL NOT be reachable without a teacher session.

#### Scenario: Reset a term
- **WHEN** the teacher confirms a class-data reset
- **THEN** all measurements and reports are gone, every patient opens with an empty Dashboard, and the patients' names and dates of birth are unchanged

#### Scenario: Reset is refused without confirmation
- **WHEN** a reset is requested without the explicit confirmation value
- **THEN** the system performs no deletion and reports the requirement

## ADDED Requirements

### Requirement: Teacher edits patient details
The teacher SHALL be able to change any patient's name and date of birth; the name SHALL be 1 to 100 characters after trimming, and the date of birth SHALL be optional, a valid calendar date, not in the future and not before 1900-01-01; an invalid change SHALL return field-level errors and write nothing.

#### Scenario: Rename a patient
- **WHEN** the teacher saves the name `Herr Berger` for a patient
- **THEN** the patient list and the workspace header show `Herr Berger` on the next load

#### Scenario: Set the date of birth
- **WHEN** the teacher saves the date of birth 07.03.1948
- **THEN** the workspace header shows 07.03.1948

#### Scenario: Clear the date of birth
- **WHEN** the teacher clears the date of birth and saves
- **THEN** the patient shows `Geburtsdatum nicht angegeben`

#### Scenario: Impossible or future date
- **WHEN** the teacher saves 31.02.1950 or a date after today
- **THEN** the system rejects it with a field error on the date and writes nothing

#### Scenario: Empty name
- **WHEN** the teacher saves a blank name
- **THEN** the system rejects it with a field error on the name and the stored name is unchanged

### Requirement: Patient detail changes are audited
Every accepted change to a patient's name or date of birth SHALL append an audit entry naming the teacher, the patient, the changed field and its previous and new value.

#### Scenario: Rename is recorded
- **WHEN** the teacher changes a name from `Frau Albrecht` to `Frau Albers`
- **THEN** an audit entry records the teacher, the patient, the name field and both values

## REMOVED Requirements

### Requirement: Per-patient expected measurements
**Reason**: Missing values are no longer signalled, so there is nothing for an expected-measurement policy to drive.
**Migration**: The teacher editor and its API are removed. The `measurement_requirements` rows stay in the database, unread.

### Requirement: Policy changes are audited
**Reason**: There are no policy changes left to audit.
**Migration**: Existing audit rows for earlier policy changes stay until the next class-data reset.
