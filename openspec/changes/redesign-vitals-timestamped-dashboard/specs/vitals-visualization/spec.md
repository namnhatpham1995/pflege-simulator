# Spec Delta

## MODIFIED Requirements

### Requirement: Default date and visible selection
The Dashboard SHALL default the selected day to today's date in `Europe/Berlin` and the view to `Tag`, and SHALL label the selected day (Tag view) or the week range (Woche view) above the chart and the entry rows.

#### Scenario: First open
- **WHEN** a visitor opens the Dashboard without a date in the URL
- **THEN** the view is Tag, the selected day is today in Berlin and that date is labelled above the chart and the rows

#### Scenario: Selection changes
- **WHEN** the visitor selects 2026-11-14
- **THEN** the label above the chart and the rows shows 14.11.2026 and that day's entries are loaded

#### Scenario: Week label
- **WHEN** the Woche view is active and the selected day is 2026-11-18
- **THEN** the label shows the range 16.11.2026 – 22.11.2026

### Requirement: Touch selection
On a touch device a tap on an entry value box SHALL show the same date and time label and the same chart highlight as hovering it, and a tap elsewhere SHALL dismiss both.

#### Scenario: Tap on a pulse box
- **WHEN** the visitor taps a pulse value box
- **THEN** its date and time are shown and the matching chart marker is highlighted

#### Scenario: Tap elsewhere
- **WHEN** the visitor taps outside any value box
- **THEN** the label and the highlight disappear

### Requirement: No fabricated or filled values
The chart and the entry rows SHALL reflect only stored entries and SHALL NOT interpolate, generate or auto-fill a measurement.

#### Scenario: Multi-day gap
- **WHEN** systolic has no entry for three consecutive days between two entries
- **THEN** the chart draws no systolic marker on those days and joins the two entries with one solid line

#### Scenario: Empty window
- **WHEN** a patient has no entries in the visible window
- **THEN** the chart shows no markers or lines and every row is empty

## ADDED Requirements

### Requirement: Dashboard is read-only
The Dashboard SHALL display stored entries only and SHALL NOT contain any input, save button or delete control.

#### Scenario: No controls to change data
- **WHEN** a visitor or the teacher views the Dashboard
- **THEN** no control on it creates, changes or removes an entry

### Requirement: Day and week views
The Dashboard SHALL offer a `Tag` and a `Woche` view; the Woche view SHALL cover Monday to Sunday of the week containing the selected day, and previous and next buttons SHALL move the window by one day in Tag view and one week in Woche view.

#### Scenario: Switch to week
- **WHEN** the selected day is Wednesday 2026-11-18 and the visitor chooses Woche
- **THEN** the window runs from Monday 2026-11-16 to Sunday 2026-11-22 and shows every entry in it

#### Scenario: Next week
- **WHEN** the visitor presses the next button in Woche view
- **THEN** the window moves to 23.11.2026 – 29.11.2026

#### Scenario: Previous day
- **WHEN** the visitor presses the previous button in Tag view on 14.11.2026
- **THEN** the selected day becomes 13.11.2026

### Requirement: Four chart series
The chart SHALL contain exactly four series — systolic in dark blue, diastolic in light blue, pulse in red and temperature in orange — each plotted against an axis labelled with its unit (`mmHg`, `Schläge/min`, `°C`), and SHALL draw a marker only where an entry exists.

#### Scenario: Series and axes
- **WHEN** the Dashboard shows a patient with entries of every charted kind
- **THEN** four series with distinct colours are drawn and the axes are labelled mmHg, Schläge/min and °C

#### Scenario: Uncharted kinds
- **WHEN** a patient has weight, height, pain and glucose entries
- **THEN** none of them appears on the chart

### Requirement: Entries are positioned by date and time
The chart SHALL place each entry horizontally by its date and time: the Tag view SHALL span 00:00 to 24:00 of the selected day, and the Woche view SHALL span Monday 00:00 to Sunday 24:00 with each entry at its time within its day.

#### Scenario: Two entries on one day
- **WHEN** pulse entries exist at 08:00 and 14:30 on the same day
- **THEN** their markers have different horizontal positions in both views, the later one further right

#### Scenario: Week shows every entry
- **WHEN** the Woche view is active and entries exist on Monday and on Sunday
- **THEN** both are drawn in one chart

### Requirement: Series lines are always solid
Consecutive entries of one series, in chronological order, SHALL be joined by a solid line regardless of the time between them, no dashed line SHALL be drawn, a lone entry SHALL appear as a marker without a line, and a gap in one series SHALL NOT change another series.

#### Scenario: Gap between entries
- **WHEN** diastolic entries exist on Monday and on Thursday and none between them
- **THEN** the two are joined by a solid line

#### Scenario: Single entry
- **WHEN** temperature has exactly one entry in the window
- **THEN** its marker is drawn and no temperature line is drawn

#### Scenario: Series are independent
- **WHEN** pulse has an entry at 10:00 and no other series does
- **THEN** only the pulse marker is drawn and the other series are unaffected

### Requirement: One row per measurement kind
Below the chart the Dashboard SHALL show one row for each of the eight kinds in the order systolic, diastolic, pulse, temperature, weight, height, pain, glucose, labelled with the unit, listing that kind's entries in the visible window as value boxes in chronological order; a row without entries SHALL be empty and neutral.

#### Scenario: Two weights
- **WHEN** weight 12 kg was saved for 10:33 and weight 13 kg for 11:00 on the visible day
- **THEN** the weight row shows two boxes, 12 then 13

#### Scenario: Rows follow the window
- **WHEN** the visitor switches from Tag to Woche
- **THEN** every row lists the entries of the whole week in chronological order

#### Scenario: Empty row
- **WHEN** no height entry exists in the window
- **THEN** the height row shows no boxes and no fault styling

### Requirement: Hover reveals date and time
Hovering or keyboard-focusing an entry value box SHALL show the entry's date and time as `TT.MM.JJJJ HH:MM`, for every kind, and the box SHALL expose the value, date and time to assistive technology.

#### Scenario: Hover a weight box
- **WHEN** the visitor hovers the weight box 12 saved for 12.11.2026 10:33
- **THEN** the label `12.11.2026 10:33` is shown

#### Scenario: Keyboard focus
- **WHEN** the visitor tabs to a value box
- **THEN** the same label is shown and the box announces its value, date and time

### Requirement: Charted kinds highlight their chart marker
Hovering or focusing a value box of a charted kind (systolic, diastolic, pulse, temperature) SHALL highlight that entry's marker on the chart and SHALL restore it on leaving; boxes of the other kinds SHALL show only the date and time, and highlighting SHALL NOT change the selected window.

#### Scenario: Highlight a pulse marker
- **WHEN** the visitor hovers the pulse box saved for 09:15
- **THEN** the pulse marker at 09:15 is highlighted and the others are not

#### Scenario: Leaving restores
- **WHEN** the pointer leaves the box
- **THEN** no marker is highlighted

#### Scenario: Uncharted kind
- **WHEN** the visitor hovers a glucose box
- **THEN** the date and time are shown and no chart marker is highlighted

### Requirement: No missing-value signalling
The Dashboard SHALL NOT show red cells, `Fehlt` text, warnings or any other indication that a measurement is expected or absent.

#### Scenario: Day with few entries
- **WHEN** a day has a single pulse entry
- **THEN** the Dashboard shows that entry and nothing about the other kinds being missing

## REMOVED Requirements

### Requirement: One active date for chart and table
**Reason**: There is no date-column table to keep in sync with the chart; entries are matched individually, not by day.
**Migration**: Replaced by `Charted kinds highlight their chart marker`.

### Requirement: Table structure and full-column highlight
**Reason**: Entries carry a time and several can exist per day, so the day-by-measurement grid no longer fits.
**Migration**: Replaced by `One row per measurement kind`.

### Requirement: Missing cells are red and announced
**Reason**: With free timestamped entries there is no per-day expectation to compare against.
**Migration**: None; see `No missing-value signalling`.

### Requirement: Exactly three chart series
**Reason**: The chart now also shows temperature.
**Migration**: Replaced by `Four chart series`.

### Requirement: Per-series solid and dashed segments
**Reason**: Entries are at arbitrary times, so day-adjacency has no meaning and gaps are no longer flagged.
**Migration**: Replaced by `Series lines are always solid`.

### Requirement: Missing-value warning
**Reason**: Missing values are no longer signalled anywhere.
**Migration**: None.

### Requirement: Optional measurements are not faults
**Reason**: The expected-measurement policy is removed, so no measurement is ever treated as a fault.
**Migration**: None; the policy tables stay in the database, unused.
