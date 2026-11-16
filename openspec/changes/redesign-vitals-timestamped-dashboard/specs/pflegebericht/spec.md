# Spec Delta

## MODIFIED Requirements

### Requirement: Immutable revision history
Every accepted edit SHALL append a revision holding the previous body, previous version, actor and time; revisions SHALL NOT be editable or deletable through the application, and the report's history SHALL be viewable.

#### Scenario: Edit creates one revision
- **WHEN** a student changes a report body and the edit is accepted
- **THEN** one revision holds the previous body and version, and the history shows it in order

#### Scenario: History is read-only
- **WHEN** any visitor, including the teacher, looks at a report's history
- **THEN** no control offers to change or remove a revision
