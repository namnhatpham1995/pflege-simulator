# pflegebericht Specification

## Purpose
Records shift-aware free-text nursing documentation with the date and time it describes, keeps several entries per day, and preserves what was written before an edit.

## Requirements

### Requirement: Report fields and defaults
A care report SHALL consist of a calendar date, a local time, a shift of `Früh`, `Spät` or `Nacht`, and a free-text body; the date SHALL default to today in `Europe/Berlin`, the time to the current Berlin time, and the shift SHALL have no default until the student chooses one.

#### Scenario: New report defaults
- **WHEN** a student opens the new-report form
- **THEN** date and time are prefilled from Berlin's current time and the shift selector is empty

#### Scenario: Missing shift
- **WHEN** the student saves without choosing a shift
- **THEN** the system refuses with a field error and stores nothing

### Requirement: Body validation
The body SHALL be required, SHALL be stored as typed apart from trimming, SHALL reject an empty or whitespace-only value, and SHALL be limited to 10,000 characters with a visible counter near the limit.

#### Scenario: Whitespace body
- **WHEN** the student saves a body of only spaces
- **THEN** the system refuses with a field error and stores nothing

#### Scenario: Too long
- **WHEN** the body exceeds 10,000 characters
- **THEN** the browser prevents further input and the server rejects the value if it is sent anyway

### Requirement: Several reports per patient and day
The system SHALL allow any number of reports for the same patient, date and shift, each with its own identity and version.

#### Scenario: Same shift twice
- **WHEN** a student saves two reports for the same date and `Früh`
- **THEN** both exist as separate records and both are listed

### Requirement: Chronological listing
Reports SHALL be listed newest first by date, then time, then creation order, showing date, time, shift, body and an edited marker; ordering SHALL be stable when date and time are equal.

#### Scenario: Equal date and time
- **WHEN** two reports share the same date and time
- **THEN** the later-created one is listed first and the order does not change between reloads

#### Scenario: Edited marker
- **WHEN** a report has been edited at least once
- **THEN** its entry shows an edited marker and offers its history

### Requirement: Version-checked editing
An edit SHALL require the version the client last read; when the stored version differs the system SHALL reject the edit with HTTP 409, return the current report and version, and write nothing.

#### Scenario: Concurrent edit
- **WHEN** two students open version 2 of a report and the first edit succeeds
- **THEN** the second edit with version 2 returns HTTP 409 with the current text and version 3

### Requirement: Immutable revision history
Every accepted edit SHALL append a revision holding the previous body, previous version, actor and time; revisions SHALL NOT be editable or deletable through the application, and the report's history SHALL be viewable.

#### Scenario: Edit creates one revision
- **WHEN** a student changes a report body and the edit is accepted
- **THEN** one revision holds the previous body and version, and the history shows it in order

#### Scenario: History is read-only
- **WHEN** any visitor, including the teacher, looks at a report's history
- **THEN** no control offers to change or remove a revision

### Requirement: Shifts belong only to Pflegebericht
The `Früh`, `Spät` and `Nacht` shift SHALL exist only in Pflegebericht; a vital-sign save SHALL reject a shift value.

#### Scenario: Shift sent with vital signs
- **WHEN** a vital-sign save contains a shift field
- **THEN** the system rejects the request as invalid and writes nothing

### Requirement: Saved state is confirmed by the server
The interface SHALL show a report as saved only after the server has accepted it and returned the stored record and version; a failed save SHALL keep the entered text and show the error.

#### Scenario: Failed save keeps the text
- **WHEN** a save fails validation
- **THEN** the form still contains what the student typed and shows the field error

#### Scenario: Successful save
- **WHEN** the server accepts the report
- **THEN** the response contains the stored record and version and the list shows it without a reload
