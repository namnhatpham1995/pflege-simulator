# vitalwerte Specification

## Purpose
Stores each vital-sign measurement as its own timestamped entry (blood pressure as a pair), and defines its validation, saving, deletion and range reads.

## Requirements

### Requirement: Eight measurement kinds
A measurement entry SHALL be exactly one of eight kinds — systolic mmHg, diastolic mmHg, pulse bpm, temperature °C, weight kg, height cm, pain score 0–10 and blood glucose mg/dL — and SHALL carry exactly one number; a day or a kind with no entries is a normal state.

#### Scenario: Empty day
- **WHEN** a client reads a date with no entries
- **THEN** the system returns an empty list rather than an error or a row of zeros

#### Scenario: Unknown field
- **WHEN** a save names a kind that is not one of the eight, or contains any other field such as a shift
- **THEN** the system rejects the request with HTTP 400 and writes nothing

#### Scenario: Entry without a number
- **WHEN** a save contains a kind with no numeric value
- **THEN** the system rejects it with a field error and writes nothing

### Requirement: Empty is never zero
Absence SHALL mean that no entry exists and SHALL NOT be represented by an entry of 0; a pain score of 0 SHALL be a valid recorded entry, and a blank input SHALL save nothing.

#### Scenario: Pain of zero
- **WHEN** a student saves pain 0
- **THEN** an entry with value 0 is stored, returned and displayed as a recorded value

#### Scenario: Blank input
- **WHEN** a student presses `Speichern` with the pain input blank
- **THEN** no entry is created and the form shows that a value is required

### Requirement: Server-side plausibility validation
The server SHALL reject a value outside the plausible range of its kind, a non-integer in an integer kind, a pain score outside 0–10, and a blood pressure pair whose diastolic value is not below its systolic value; a rejected save SHALL return field-level errors and write nothing, and entries made at different times SHALL NOT be compared with each other.

#### Scenario: Out of range
- **WHEN** a save contains a pulse of 900
- **THEN** the system returns HTTP 400 naming the pulse field and no entry is created

#### Scenario: Diastolic not below systolic
- **WHEN** a blood pressure save sets systolic 120 and diastolic 120
- **THEN** the system rejects it with a message on the diastolic field and writes nothing

#### Scenario: Valid boundary
- **WHEN** saves set pain 0 and pain 10
- **THEN** both are accepted

#### Scenario: Different times are independent
- **WHEN** a pair 120/80 exists at 08:00 and a pair 110/70 is saved for 09:00
- **THEN** the second save is accepted regardless of the first

### Requirement: German decimal input
Decimal measurements SHALL accept a comma or a dot as the decimal separator and SHALL be stored in one normalised form.

#### Scenario: Comma separator
- **WHEN** a student enters `36,8` in temperature
- **THEN** the system stores 36.8 and displays a value equal to 36.8

#### Scenario: Dot separator
- **WHEN** a student enters `36.8` in temperature
- **THEN** the system stores the same value as for `36,8`

### Requirement: Bounded inclusive range reads
Measurement entries SHALL be read for an inclusive calendar-date range ordered by date, then time, then creation, and a request outside the maximum window SHALL be rejected rather than served unbounded.

#### Scenario: Range read
- **WHEN** a client requests 2026-11-01 to 2026-11-14
- **THEN** the response contains every entry dated within that range ordered by date and time and no entry outside it

#### Scenario: Equal times keep creation order
- **WHEN** two entries of one kind share a date and time
- **THEN** they are returned in the order they were saved

#### Scenario: Unbounded request
- **WHEN** a client requests a range longer than the maximum window or with the ends reversed
- **THEN** the system returns HTTP 400 and no data

### Requirement: Reading never creates a record
Reading a date with no record SHALL return an empty day and SHALL NOT insert a row.

#### Scenario: Selecting an empty day
- **WHEN** a student selects a date that has no record and only looks at it
- **THEN** the response is an empty day and the record count for that patient is unchanged

### Requirement: Dates and times are timezone-free
An entry's date SHALL be an ISO `YYYY-MM-DD` calendar date and its time a 24-hour `HH:MM` wall-clock time; both SHALL be stored and shown exactly as entered, never converted through UTC or a timezone, and defaults taken from the current moment SHALL use Europe/Berlin.

#### Scenario: Different client timezones
- **WHEN** clients in two different timezones both save for 2026-11-12 at 09:15
- **THEN** both entries are stored and shown as 12.11.2026 09:15

#### Scenario: Nonexistent local time
- **WHEN** a student saves 02:30 on 2027-03-28, a time skipped by the clock change
- **THEN** the entry is accepted and shown as 02:30

#### Scenario: Invalid time
- **WHEN** a save contains the time 24:00 or 12:60
- **THEN** the system rejects it with a field error on the time and writes nothing

### Requirement: Writes are audited
Every accepted entry creation and deletion SHALL append an audit entry naming the actor (a teacher or an anonymous student), the patient, the action and the entry's kind, value, date and time, and the application SHALL NOT offer a way to update or delete an audit entry.

#### Scenario: Save is recorded
- **WHEN** a student saves a pulse of 82 for 09:15
- **THEN** one audit entry records the action, the patient, the pulse kind, 82 and the date and time

#### Scenario: Delete is recorded
- **WHEN** a student deletes that entry
- **THEN** one further audit entry records the deletion with the removed value, date and time

#### Scenario: Reads are not recorded
- **WHEN** a visitor only reads entries
- **THEN** no audit entry is written

### Requirement: Timestamped measurement entries
Each saved value SHALL be stored as its own entry holding the patient, kind, value, observed date and observed time, with no uniqueness limit, so that any number of entries of the same kind on the same day, even at the same minute, is allowed.

#### Scenario: Two weights on one day
- **WHEN** a student saves weight 12 at 10:33 and weight 13 at 11:00 on the same day
- **THEN** both entries exist and neither replaces the other

#### Scenario: Same minute twice
- **WHEN** two pulse entries are saved for the same date and time
- **THEN** both are stored

### Requirement: One input tab per category
The Vitalwerte tab SHALL show one tab per category — Blutdruck, Puls, Temperatur, Gewicht, Größe, Schmerzen, Blutzucker — and selecting one SHALL show only that category's inputs, with Blutdruck holding a systolic and a diastolic input.

#### Scenario: Seven category tabs
- **WHEN** a visitor opens the Vitalwerte tab
- **THEN** seven category tabs are shown and one category's form is visible

#### Scenario: Blutdruck has two inputs
- **WHEN** the Blutdruck tab is selected
- **THEN** it shows one systolic and one diastolic input and no input of another category

#### Scenario: Single-value category
- **WHEN** the Gewicht tab is selected
- **THEN** it shows exactly one value input

### Requirement: Entry form with day, time and explicit save
Each category form SHALL contain its value input or inputs, a day selector, an `HH:MM` time input and a `Speichern` button; day and time SHALL default to the current day and time in Berlin, and nothing SHALL be stored until the button is pressed.

#### Scenario: Defaults are now
- **WHEN** a visitor opens a category form
- **THEN** the day is today and the time is the current Berlin time

#### Scenario: Typing stores nothing
- **WHEN** a student types a value and leaves the field without pressing `Speichern`
- **THEN** no entry is created

#### Scenario: Chosen day and time are stored
- **WHEN** a student chooses 12.11.2026 and 09:15, types a value and presses `Speichern`
- **THEN** the stored entry has the date 2026-11-12 and the time 09:15

#### Scenario: Form resets after save
- **WHEN** the server accepts a save
- **THEN** the value inputs are empty and the day and time are set to the current day and time again

### Requirement: Blood pressure is saved as a pair
Saving Blutdruck SHALL require both a systolic and a diastolic value, SHALL store them as two entries with the same date and time in one atomic operation, and SHALL store neither if either is missing or invalid.

#### Scenario: Both values stored
- **WHEN** a student saves 120 and 80 for 08:00
- **THEN** a systolic entry of 120 and a diastolic entry of 80 exist with the same date and time

#### Scenario: One value missing
- **WHEN** a student presses `Speichern` with only the systolic input filled
- **THEN** no entry is created and the diastolic input shows that a value is required

#### Scenario: One value invalid
- **WHEN** the systolic value is valid and the diastolic value is out of range
- **THEN** neither entry is stored

### Requirement: Entries are deleted, not edited
A saved entry SHALL NOT be editable. A visitor without a teacher session SHALL be able to delete an entry after confirming, a blood pressure pair SHALL be deleted as one unit, and the Vitalwerte tab SHALL list up to the 50 most recent entries of the selected category, newest first, with date and time.

#### Scenario: Delete after confirmation
- **WHEN** a student confirms the deletion of an entry
- **THEN** the entry is removed and disappears from the list and the dashboard

#### Scenario: Cancel keeps the entry
- **WHEN** a student opens the deletion confirmation and cancels
- **THEN** the entry remains

#### Scenario: Pair deleted together
- **WHEN** a student deletes a blood pressure entry
- **THEN** its systolic and diastolic values are both removed

#### Scenario: No edit control
- **WHEN** a visitor views a saved entry
- **THEN** no control offers to change its value, date or time

### Requirement: Saves and deletes never conflict
Saving or deleting an entry SHALL NOT require a version, two visitors saving at the same time SHALL both succeed, and deleting an entry that no longer exists SHALL change nothing.

#### Scenario: Concurrent saves
- **WHEN** two visitors save a pulse for the same patient at the same moment
- **THEN** both entries exist afterwards and neither request is rejected

#### Scenario: Deleting twice
- **WHEN** a second delete arrives for an entry that was already deleted
- **THEN** the system returns HTTP 404 and no other entry changes

### Requirement: Saved state is confirmed by the server
The Vitalwerte tab SHALL show a new entry as saved only after the server accepted it, and a failed save SHALL keep the typed values, day and time and show the field errors.

#### Scenario: Failed save keeps the input
- **WHEN** a save fails validation
- **THEN** the form still contains the typed values, day and time and shows the field error

#### Scenario: Successful save
- **WHEN** the server accepts the entry
- **THEN** the list shows it without a reload
