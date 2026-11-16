# Spec Delta

## Purpose

Gives the teacher a class-wide read-only view of the ten fictional patients, control over which measurements count as expected, and a safe way to clear a term's entries.

## ADDED Requirements

### Requirement: Teacher-wide read-only patient access
The teacher SHALL open the workspace of every fictional patient and read their vital signs and care reports; changing a patient's entries SHALL NOT be offered to the teacher role.

#### Scenario: Review any patient
- **WHEN** the teacher opens patient 7's workspace
- **THEN** the chart, table and reports for patient 7 are shown

#### Scenario: No edit controls
- **WHEN** the teacher views a patient's vital signs or reports
- **THEN** no control offers to change or delete them

### Requirement: Teacher-only routes
The teacher console and the expected-measurement API SHALL require a teacher session and SHALL return HTTP 403 to a group session.

#### Scenario: Group opens the console
- **WHEN** a group session requests the teacher console or its API
- **THEN** the system returns HTTP 403 and shows no class data

### Requirement: Per-patient expected measurements
The teacher SHALL mark each of the eight measurements as expected or optional for a patient, with systolic, diastolic and pulse expected by default, and an accepted change SHALL affect that patient's missing-value warnings on the next load.

#### Scenario: Enable an optional field
- **WHEN** the teacher marks weight expected for patient 3
- **THEN** an empty weight for patient 3 is reported as missing and its cell is red

#### Scenario: Disable a default field
- **WHEN** the teacher marks pulse optional for patient 3
- **THEN** an empty pulse for patient 3 is no longer red or listed in the warning

#### Scenario: Other patients are unaffected
- **WHEN** the teacher changes patient 3's policy
- **THEN** patient 4's warnings are unchanged

### Requirement: Policy changes are audited
Every accepted change to a patient's expected measurements SHALL append an audit entry naming the teacher, the patient, the changed field and the new state.

#### Scenario: Toggle is recorded
- **WHEN** the teacher marks temperature expected
- **THEN** an audit entry records the teacher, the patient, the field and its new expected state

### Requirement: Class roster baseline
The seeded data SHALL contain exactly ten fictional patients and ten groups, one group per patient, with stable opaque identifiers; re-running the seed SHALL NOT duplicate patients, groups or assignments.

#### Scenario: Idempotent seed
- **WHEN** the seed runs twice
- **THEN** there are still exactly ten patients and ten groups, each with the same identifiers as after the first run

#### Scenario: One group per patient
- **WHEN** the roster is inspected
- **THEN** every patient is assigned to exactly one group and no group is assigned to two patients

### Requirement: Class-data reset
A reset operation SHALL remove all vital-sign records, care reports, revisions and audit entries across the ten patients while keeping the patients, groups and their access codes; it SHALL require an explicit confirmation and SHALL NOT be reachable without a teacher session.

#### Scenario: Reset a term
- **WHEN** the teacher confirms a class-data reset
- **THEN** all measurements and reports are gone, and every group can still sign in with its existing code and start from an empty day

#### Scenario: Reset is refused without confirmation
- **WHEN** a reset is requested without the explicit confirmation value
- **THEN** the system performs no deletion and reports the requirement
