# Spec Delta

## Purpose

Defines how a visitor gets from the front page into a patient's workspace and how the workspace is divided into the Dashboard, Vitalwerte and Pflegebericht sections.

## ADDED Requirements

### Requirement: Front page starts the simulator
The front page SHALL offer one primary button labelled `Start` that opens the list of patients, and SHALL NOT show an access-code field or any control that asks for a group access code.

#### Scenario: Start opens the patient list
- **WHEN** a visitor without a session presses `Start`
- **THEN** the patient list opens without any sign-in step

#### Scenario: No access-code entry
- **WHEN** a visitor opens the front page
- **THEN** no input, button or link asks for an access code

### Requirement: Teacher sign-in stays reachable
The front page SHALL keep the teacher sign-in reachable through a visually secondary link so that it is not mistaken for the student entry point.

#### Scenario: Teacher link
- **WHEN** the teacher opens the front page
- **THEN** a secondary link leads to the teacher password form and `Start` remains the only primary button

### Requirement: Three workspace sections in fixed order
A patient workspace SHALL show exactly three section tabs in this order: `Dashboard`, `Vitalwerte`, `Pflegebericht`; the current tab SHALL be marked and each tab SHALL be reachable by keyboard and by its own URL.

#### Scenario: Tab order
- **WHEN** a visitor opens any patient
- **THEN** the tabs read Dashboard, Vitalwerte, Pflegebericht from left to right and no other section tab exists

#### Scenario: Current tab is marked
- **WHEN** the visitor is on the Vitalwerte tab
- **THEN** that tab is visibly marked and exposed to assistive technology as the current page

#### Scenario: Direct link
- **WHEN** a visitor opens the Pflegebericht URL of a patient directly
- **THEN** the Pflegebericht tab is shown as current without passing through another tab

### Requirement: Patient details are shown
The patient list and the workspace header SHALL show the patient's name and date of birth formatted as `TT.MM.JJJJ`, and SHALL show `Geburtsdatum nicht angegeben` when no date of birth is stored; both SHALL reflect a teacher's change on the next load.

#### Scenario: Header shows details
- **WHEN** a visitor opens a patient whose date of birth is 1948-03-07
- **THEN** the header shows the patient's name and 07.03.1948

#### Scenario: No date of birth yet
- **WHEN** a patient has no stored date of birth
- **THEN** the header and the list show `Geburtsdatum nicht angegeben` and no date

#### Scenario: Change becomes visible
- **WHEN** the teacher renames a patient and a student reloads the patient list
- **THEN** the list shows the new name

### Requirement: Dashboard is the landing section
Opening a patient without naming a section SHALL show the Dashboard.

#### Scenario: Open a patient
- **WHEN** a visitor chooses a patient from the list
- **THEN** the Dashboard of that patient opens
