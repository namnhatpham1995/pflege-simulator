# Spec Delta

## Purpose

Holds exactly one set of eight vital-sign measurements per patient and calendar day and defines its validation, emptiness, clearing and conflict behaviour.

## ADDED Requirements

### Requirement: One record per patient and calendar day
The system SHALL keep at most one vital-sign record per patient and calendar date, enforced by a database constraint, and two concurrent first saves for the same day SHALL leave exactly one record.

#### Scenario: Concurrent first save
- **WHEN** two clients save values for the same patient and date that has no record yet
- **THEN** exactly one record exists afterwards and its values come from one of the two requests, not a merge of both

#### Scenario: Second save updates the existing record
- **WHEN** a day already has a record and a new save for that day is accepted
- **THEN** the existing record is updated and no second row is created

### Requirement: Exactly eight nullable measurements
A vital-sign record SHALL carry only these eight measurements: systolic mmHg, diastolic mmHg, pulse bpm, temperature °C, weight kg, height cm, pain score 0–10 and blood glucose mg/dL; every field SHALL be optional and a day SHALL legitimately have no record.

#### Scenario: Empty day
- **WHEN** a client reads a date with no record
- **THEN** the system returns an empty day rather than an error or a row of zeros

#### Scenario: Unknown field
- **WHEN** a save contains a field that is not one of the eight measurements or the version
- **THEN** the system rejects the request with HTTP 400 and writes nothing

### Requirement: Empty is never zero
Absence SHALL be stored as NULL and SHALL NOT be represented by 0; a pain score of 0 SHALL be stored, returned and displayed as a recorded value.

#### Scenario: Pain of zero
- **WHEN** a student saves pain 0
- **THEN** the record stores 0, the table shows 0, and the day no longer reports pain as missing

#### Scenario: Blank field
- **WHEN** a student leaves pain blank
- **THEN** the record stores NULL and the field is treated as unrecorded, not as 0

### Requirement: Server-side plausibility validation
The server SHALL reject values outside the configured plausible range, non-integers in integer fields, a pain score outside 0–10, and a diastolic value that is not below the systolic value when both are present on that day; a rejected save SHALL return field-level errors and write nothing.

#### Scenario: Out of range
- **WHEN** a save contains a pulse of 900
- **THEN** the system returns HTTP 400 naming the pulse field and the stored record is unchanged

#### Scenario: Diastolic not below systolic
- **WHEN** a save sets systolic 120 and diastolic 120 on the same day
- **THEN** the system rejects it with a message on the diastolic field and writes nothing

#### Scenario: Valid boundary
- **WHEN** a save sets pain 0 and pain 10 on separate days
- **THEN** both are accepted

### Requirement: German decimal input
Decimal measurements SHALL accept a comma or a dot as the decimal separator and SHALL be stored in one normalised form.

#### Scenario: Comma separator
- **WHEN** a student enters `36,8` in temperature
- **THEN** the system stores 36.8 and displays a value equal to 36.8

#### Scenario: Dot separator
- **WHEN** a student enters `36.8` in temperature
- **THEN** the system stores the same value as for `36,8`

### Requirement: Partial update and explicit clearing
A save SHALL change only the fields present in the request; a field sent as null SHALL be cleared; a field omitted from the request SHALL keep its stored value.

#### Scenario: Clear one field
- **WHEN** a save sends pain as null and omits temperature
- **THEN** pain becomes NULL and the stored temperature is unchanged

#### Scenario: Clear the last value
- **WHEN** a save sets every measurement to null
- **THEN** the record remains with all values NULL and the day reads as empty

### Requirement: Version-checked saving
A save SHALL require the version the client last read; when the stored version differs the system SHALL reject the save with HTTP 409, return the current record and version, and write nothing.

#### Scenario: Stale save
- **WHEN** two clients read version 3 and the first save succeeds
- **THEN** the second save with version 3 returns HTTP 409 with the current values and version 4

#### Scenario: Retry after refresh
- **WHEN** the student reloads the returned current record and saves again with its version
- **THEN** the save succeeds and the version increases by one

### Requirement: Bounded inclusive range reads
Vital-sign records SHALL be read for an inclusive calendar-date range in ascending date order, and a request outside the maximum window SHALL be rejected rather than served unbounded.

#### Scenario: Range read
- **WHEN** a client requests 2026-11-01 to 2026-11-14
- **THEN** the response contains every existing record in that range in ascending date order and no record outside it

#### Scenario: Unbounded request
- **WHEN** a client requests a range longer than the maximum window or with the ends reversed
- **THEN** the system returns HTTP 400 and no data

### Requirement: Reading never creates a record
Reading a date with no record SHALL return an empty day and SHALL NOT insert a row.

#### Scenario: Selecting an empty day
- **WHEN** a student selects a date that has no record and only looks at it
- **THEN** the response is an empty day and the record count for that patient is unchanged

### Requirement: Calendar dates are timezone-free
A vital-sign date SHALL be an ISO `YYYY-MM-DD` calendar date with no time or offset, and it SHALL denote the same day for every client regardless of the client's timezone.

#### Scenario: Different client timezones
- **WHEN** clients in two different timezones both select 2026-11-12
- **THEN** both read and write the record for 2026-11-12 and neither sees 2026-11-11 or 2026-11-13

### Requirement: Writes are audited
Every accepted vital-sign write SHALL append an audit entry naming the actor, patient, date, changed fields and each previous and new value, and the application SHALL NOT offer a way to update or delete an audit entry.

#### Scenario: Edit is recorded
- **WHEN** a student changes pulse from 78 to 82
- **THEN** one audit entry records the actor, the patient, the date, the pulse field and both values

#### Scenario: Reads are not recorded
- **WHEN** a student only reads a day
- **THEN** no audit entry is written
