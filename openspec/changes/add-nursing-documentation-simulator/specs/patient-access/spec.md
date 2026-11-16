# Spec Delta

## Purpose

Authenticates student groups and the teacher, keeps sessions revocable, and confines every read and write to the patient the authenticated actor is allowed to see.

## ADDED Requirements

### Requirement: Group access-code login
The system SHALL authenticate a student group only with that group's access code and SHALL reject unknown, malformed and deactivated codes with one generic message that does not reveal whether the code or the group exists.

#### Scenario: Valid group code
- **WHEN** a student submits the access code of an active group
- **THEN** the system creates a session for that group and opens the group's patient workspace

#### Scenario: Unknown code
- **WHEN** a student submits a code that matches no group
- **THEN** the system returns HTTP 401 with the generic message and sets no session cookie

#### Scenario: Deactivated group
- **WHEN** the code belongs to a group whose active flag is false
- **THEN** the system refuses the login with the same message and status as an unknown code

### Requirement: Independent teacher authentication
The teacher account SHALL authenticate with its own credential, which SHALL NOT be derived from a group access code, and a group session SHALL NOT grant teacher privileges.

#### Scenario: Teacher signs in
- **WHEN** the teacher submits the teacher credential
- **THEN** the system creates a teacher session and opens the teacher console

#### Scenario: Group code cannot act as teacher
- **WHEN** a request to a teacher-only page or API is made with a group session
- **THEN** the system returns HTTP 403 and discloses no teacher data

### Requirement: Server-issued revocable sessions
Sessions SHALL be opaque random tokens delivered in an HttpOnly, SameSite=Lax cookie that is Secure outside local development; only a hash of the token SHALL be stored; every login SHALL issue a new token; logout SHALL revoke the stored session immediately.

#### Scenario: Session cookie attributes
- **WHEN** a login succeeds in production
- **THEN** the response sets one session cookie that is HttpOnly, Secure and SameSite=Lax and carries no readable identity data

#### Scenario: Logout
- **WHEN** a signed-in actor logs out
- **THEN** the stored session is revoked and a later request with the old cookie is treated as unauthenticated

#### Scenario: Login while already signed in
- **WHEN** a login succeeds while the browser already holds a session cookie
- **THEN** the system issues a different token and the previous token no longer authenticates

### Requirement: Session expiry
Sessions SHALL expire after an absolute lifetime and after a shorter idle period, and an expired session SHALL be rejected as unauthenticated without extending itself.

#### Scenario: Idle expiry
- **WHEN** a session has not been used for longer than the idle period
- **THEN** the next request is unauthenticated and the workspace shows the login page

#### Scenario: Absolute expiry
- **WHEN** a session reaches its absolute lifetime during active use
- **THEN** the next request is unauthenticated

### Requirement: Per-request patient authorisation
Every read and write of patient data SHALL verify on the server that the session's actor may access the patient named in the request; a group SHALL reach only its assigned patient and the teacher SHALL reach all ten; a refused request SHALL change no data.

#### Scenario: Group reads its own patient
- **WHEN** a group requests its assigned patient's vital signs
- **THEN** the request succeeds

#### Scenario: Group guesses another patient
- **WHEN** a group requests another group's patient by URL or API id
- **THEN** the system returns HTTP 403 with no patient data and no record is created

#### Scenario: Group mutates another patient
- **WHEN** a group sends a save for another group's patient
- **THEN** the system rejects it with HTTP 403 and the stored record is unchanged

### Requirement: Authorised patient list only
The patient list SHALL contain only patients the actor may open; a student group SHALL see exactly its assigned patient.

#### Scenario: Student list
- **WHEN** a group opens the patient list
- **THEN** it contains exactly one entry, the group's assigned patient

#### Scenario: Teacher list
- **WHEN** the teacher opens the patient list
- **THEN** it contains all ten fictional patients

### Requirement: Unauthenticated access is refused per surface
Pages that need a session SHALL show the login page when it is missing, and APIs that need a session SHALL return HTTP 401 with a JSON error body rather than a redirect or an HTML page.

#### Scenario: Anonymous API call
- **WHEN** a request without a session calls a patient API
- **THEN** the system returns HTTP 401 and a JSON error body

#### Scenario: Anonymous page
- **WHEN** a browser without a session opens a patient workspace URL
- **THEN** the system shows the login page and no patient data

### Requirement: Login throttling
Failed logins SHALL be throttled by a store shared across server instances, and the refusal SHALL state when the next attempt is allowed.

#### Scenario: Repeated failures
- **WHEN** failed logins for the same group key exceed the allowed number within the window
- **THEN** further attempts return HTTP 429 with a retry time and a correct code does not bypass the limit

#### Scenario: Successful login clears the counter
- **WHEN** a login succeeds before the limit is reached
- **THEN** the failure counter for that key is cleared

### Requirement: Origin-checked mutations
State-changing requests SHALL require a same-origin `Origin` header and SHALL be rejected when it is absent, foreign or inconsistent with the request host, even with a valid session cookie.

#### Scenario: Foreign origin
- **WHEN** a save request arrives with a valid session and an `Origin` of another site
- **THEN** the system returns HTTP 403 and changes nothing

### Requirement: Access codes are generated, hashed and delivered once
Group access codes SHALL be generated with at least 128 bits of randomness and stored only as a slow hash; seeding SHALL show each new code once in the operator's terminal and may write it only to a path excluded from version control.

#### Scenario: Seed delivery
- **WHEN** the seed runs for the first time
- **THEN** it shows each group's code once to the operator and stores only hashes

#### Scenario: No plaintext at rest
- **WHEN** the database is inspected after seeding
- **THEN** no column contains a group access code in plaintext
