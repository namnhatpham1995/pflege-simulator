# Spec Delta

## Purpose

Presents daily vital signs across calendar dates so a group can see gaps in the record and correct them, with one chart and one table that always agree on the active date.

## ADDED Requirements

### Requirement: Default date and visible selection
The workspace SHALL default the active date to today's date in `Europe/Berlin` and SHALL show the selected date above both the chart and the table.

#### Scenario: First open
- **WHEN** a student opens Vitalwerte without a date in the URL
- **THEN** the active date is today in Berlin and the same date is labelled above the chart and the table

#### Scenario: Selection changes
- **WHEN** the student selects 2026-11-14
- **THEN** the label above both surfaces shows 14.11.2026 and that day's data is loaded

### Requirement: Independent day, month and year controls
The date control SHALL expose day, month and year as three independently editable inputs; the day list SHALL offer only days valid for the chosen month and year, the month list SHALL offer twelve months, and the year SHALL accept free numeric entry rather than a short preset range.

#### Scenario: Day list follows month length
- **WHEN** the selected month and year are February 2028 and then February 2027
- **THEN** the day list offers 29 days and then 28 days

#### Scenario: Free year entry
- **WHEN** the student types the year 2126
- **THEN** the control accepts it and loads that calendar year

### Requirement: Calendar popover
A calendar button SHALL open a month-view popover that selects a full date and keeps the day, month and year inputs in sync with the chosen date.

#### Scenario: Choose a date in the popover
- **WHEN** the student opens the popover and chooses 15 March 2027
- **THEN** the inputs show 15, March and 2027 and the workspace loads 2027-03-15

### Requirement: Impossible dates are refused, not corrected
The control SHALL reject impossible combinations such as 31 February and SHALL NOT silently clamp, roll over or shift them to another date.

#### Scenario: 31 February
- **WHEN** the student enters day 31 with February 2027
- **THEN** the control shows an inline error, requests no data, and keeps the previously selected date active

#### Scenario: Leap day
- **WHEN** the student selects 29 February 2028 and then 29 February 2027
- **THEN** the first is accepted and the second is refused

### Requirement: Keyboard and touch operation
The date control SHALL be operable with the keyboard alone and by pointer or touch, with labelled controls, a visible focus indicator, and Escape closing any open list or popover.

#### Scenario: Keyboard only
- **WHEN** the student tabs to the month control, opens it, moves with the arrow keys and presses Enter
- **THEN** the month changes without a pointer

#### Scenario: Escape
- **WHEN** the student presses Escape while the calendar popover is open
- **THEN** the popover closes and focus returns to the button that opened it

### Requirement: Dates never move through timezone conversion
The selected date SHALL be sent, stored and displayed as the same `YYYY-MM-DD` string in every client timezone and SHALL NOT pass through a UTC timestamp.

#### Scenario: Client west of UTC
- **WHEN** a client in UTC-8 selects 2026-11-12
- **THEN** the request and the displayed value are 2026-11-12, not 2026-11-11 or 2026-11-13

### Requirement: One active date for chart and table
The chart and the table SHALL derive their highlight from one active date, defined as the hovered date when a date is hovered and otherwise the selected date; hovering SHALL NOT change the selection and leaving the surface SHALL restore the selected date's highlight.

#### Scenario: Hover then leave
- **WHEN** the selected date is 12.11 and the student hovers 11.11 and then moves the pointer away
- **THEN** only 11.11 is highlighted while hovering and 12.11 is highlighted again afterwards

#### Scenario: Click while hovering
- **WHEN** the student clicks the hovered date 11.11
- **THEN** 11.11 becomes the persistent selection and stays highlighted after the pointer leaves

### Requirement: Table structure and full-column highlight
The table SHALL show calendar dates as columns and the eight measurements as rows, SHALL scroll horizontally on narrow viewports, and SHALL mark the active column with a full-height highlight covering its header and all eight cells while keeping the focused editor visually distinct.

#### Scenario: Column highlight
- **WHEN** 12.11 is the active date
- **THEN** its header and all eight cells share one continuous highlight and the cell being edited has an additional focus outline

#### Scenario: Narrow viewport
- **WHEN** the table is wider than the viewport
- **THEN** the table scrolls horizontally and the row labels stay readable

### Requirement: Missing cells are red and announced
A cell whose measurement is expected on the active day but has no stored value SHALL use a red fill and red border together with a non-colour indicator and accessible text, and it SHALL remain red inside the highlighted column.

#### Scenario: Missing pulse
- **WHEN** pulse is expected and empty on 12.11
- **THEN** the pulse cell of 12.11 is red, shows `Fehlt` and exposes that text to assistive technology

#### Scenario: Missing inside the active column
- **WHEN** 12.11 is the active date and its temperature is expected and empty
- **THEN** the temperature cell stays red and labelled even though the column is highlighted

### Requirement: Exactly three chart series
The chart SHALL contain exactly three series — systolic in dark blue, diastolic in light blue and pulse in red — with axis units labelled `mmHg` and `Schläge/min`, and it SHALL draw a marker only where a stored value exists.

#### Scenario: No fabricated marker
- **WHEN** diastolic is empty on 11.11
- **THEN** the diastolic series has no marker for 11.11 while systolic and pulse keep theirs

### Requirement: Per-series solid and dashed segments
Each series SHALL draw a solid segment between consecutive values on adjacent calendar dates and a dashed segment when one or more intervening dates have no value for that series; a lone value SHALL appear as a marker without a line, and a gap in one series SHALL NOT change another series' line style.

#### Scenario: Mixed gaps
- **WHEN** the records are 10.11 systolic 120, diastolic 80, pulse 72; 11.11 systolic 125, pulse 78; 12.11 systolic 130, diastolic 85; 13.11 systolic 128, diastolic 82, pulse 80
- **THEN** systolic is solid throughout, diastolic is dashed from 10.11 to 12.11, and pulse is dashed from 11.11 to 13.11

#### Scenario: Single value
- **WHEN** pulse has exactly one value in the visible window
- **THEN** the chart shows its marker and draws no pulse line

### Requirement: Missing-value warning
A warning directly below the chart SHALL name the active date and every expected measurement missing on it, SHALL refresh when the active date changes or a save succeeds, and SHALL announce updates politely to assistive technology.

#### Scenario: Warning lists the gaps
- **WHEN** 12.11 is active and pulse, temperature and pain are expected and empty
- **THEN** the warning reads `12.11.2026: Fehlende Werte: Puls, Temperatur, Schmerzen`

#### Scenario: Warning clears
- **WHEN** the student saves the last missing expected value for the active day
- **THEN** the warning disappears without a page reload

### Requirement: Optional measurements are not faults
A blank measurement SHALL NOT be reported as missing unless the active policy for that patient marks it expected, and systolic, diastolic and pulse SHALL be expected by default.

#### Scenario: Blank weight
- **WHEN** weight is not expected and is empty
- **THEN** its cell is not red and the warning does not name it

#### Scenario: Teacher marks weight expected
- **WHEN** the teacher marks weight expected for the patient
- **THEN** an empty weight cell becomes red and the warning names it on the next load

### Requirement: No fabricated or filled values
The chart, the table and the warning SHALL reflect only stored values and SHALL NOT interpolate, generate or auto-fill a missing measurement.

#### Scenario: Multi-day gap
- **WHEN** systolic has no value for three consecutive days between two recorded days
- **THEN** the chart draws no systolic points on those days and only a dashed segment across them

### Requirement: Touch selection
On a touch device a tap SHALL select a date and a press-and-hold SHALL preview the same highlight before an editor opens.

#### Scenario: Tap on a cell
- **WHEN** the student taps the 11.11 cell
- **THEN** 11.11 becomes the active date and the whole column is highlighted

#### Scenario: Press and hold
- **WHEN** the student presses and holds a cell
- **THEN** the column highlights before any input opens and releasing leaves the date selected
