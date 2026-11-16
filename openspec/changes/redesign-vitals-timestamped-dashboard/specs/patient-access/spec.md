# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Authorised patient list only`
- TO: `### Requirement: Open patient list`

- FROM: `### Requirement: Unauthenticated access is refused per surface`
- TO: `### Requirement: Only teacher surfaces require a session`

## MODIFIED Requirements

### Requirement: Independent teacher authentication
The teacher account SHALL authenticate with one password configured on the server and SHALL NOT be subject to a length or complexity rule beyond a non-empty value; an anonymous visitor SHALL NOT receive teacher privileges.

#### Scenario: Teacher signs in
- **WHEN** the teacher submits the configured teacher password
- **THEN** the system creates a teacher session and opens the teacher console

#### Scenario: Wrong password
- **WHEN** a visitor submits a password that is not the teacher password
- **THEN** the system returns HTTP 401 with one generic message and sets no session cookie

#### Scenario: Short password accepted
- **WHEN** the configured teacher password is a short, simple phrase
- **THEN** signing in with exactly that phrase succeeds

#### Scenario: Anonymous visitor cannot act as teacher
- **WHEN** a request to a teacher-only page or API carries no teacher session
- **THEN** the system refuses it and discloses no teacher data

### Requirement: Per-request patient authorisation
Every read and write of patient data SHALL verify on the server that the named patient exists. Any visitor, with or without a session, SHALL read any patient and add or delete that patient's measurement entries and care reports. A teacher session SHALL read every patient but SHALL NOT add or delete entries or reports; a refused request SHALL change no data.

#### Scenario: Anonymous visitor reads a patient
- **WHEN** a request without a session asks for a patient's measurements
- **THEN** the request succeeds

#### Scenario: Anonymous visitor saves an entry
- **WHEN** a same-origin request without a session saves a valid measurement for any patient
- **THEN** the entry is stored for that patient

#### Scenario: Unknown patient
- **WHEN** a request names a patient id that does not exist
- **THEN** the system returns HTTP 404 with no patient data and creates nothing

#### Scenario: Teacher cannot write
- **WHEN** a request with a teacher session tries to save or delete a measurement entry or care report
- **THEN** the system returns HTTP 403 and the stored data is unchanged

### Requirement: Open patient list
The patient list SHALL contain all ten patients for every visitor and SHALL NOT require a session.

#### Scenario: Visitor list
- **WHEN** a visitor without a session opens the patient list
- **THEN** it contains all ten fictional patients

#### Scenario: Teacher list
- **WHEN** the teacher opens the patient list
- **THEN** it contains the same ten patients

### Requirement: Only teacher surfaces require a session
Teacher pages SHALL show the teacher login page when the session is missing, teacher APIs SHALL return HTTP 401 with a JSON error body rather than a redirect or an HTML page, and patient pages and patient read and write APIs SHALL NOT require a session.

#### Scenario: Anonymous teacher API call
- **WHEN** a request without a session calls a teacher API
- **THEN** the system returns HTTP 401 and a JSON error body

#### Scenario: Anonymous teacher page
- **WHEN** a browser without a session opens the teacher console
- **THEN** the system shows the teacher login page and no class data

#### Scenario: Anonymous patient page
- **WHEN** a browser without a session opens a patient workspace URL
- **THEN** the workspace opens

### Requirement: Login throttling
Failed teacher logins SHALL be throttled by a store shared across server instances, and the refusal SHALL state when the next attempt is allowed.

#### Scenario: Repeated failures
- **WHEN** failed teacher logins from the same client exceed the allowed number within the window
- **THEN** further attempts return HTTP 429 with a retry time and a correct password does not bypass the limit

#### Scenario: Successful login clears the counter
- **WHEN** a teacher login succeeds before the limit is reached
- **THEN** the failure counter for that client is cleared

## REMOVED Requirements

### Requirement: Group access-code login
**Reason**: Students no longer sign in; the simulator holds only invented data and the access codes added friction without protecting anything.
**Migration**: Students press `Start` on the front page and open any patient from the list. Existing group rows and hashed codes stay in the database, unused.

### Requirement: Access codes are generated, hashed and delivered once
**Reason**: There are no group access codes to generate, hash or hand out.
**Migration**: The seed no longer creates groups or prints codes; the teacher password is configured through `TEACHER_PASSWORD_HASH` as before.
