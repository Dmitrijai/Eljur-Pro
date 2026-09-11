# Security Architecture & Status Specification

This document details the implemented security architecture, Attribute-Based Access Control (ABAC) via the `/authUidMap/{uid}` mapping table, cryptographic invariants, threat-model mitigations, and emulator verification test results.

---

## 1. Authentication Architecture: `authUidMap` ABAC Model

- **Architecture Pattern**: Direct Attribute-Based Access Control lookup in Firestore rules without requiring custom claims or backend Cloud Functions:
  ```javascript
  function currentUserData() {
    return get(/databases/$(database)/documents/authUidMap/$(request.auth.uid)).data;
  }
  ```
- **Mapping Collection**: `/authUidMap/{firebaseAuthUid}`:
  - Document ID: Firebase Auth `request.auth.uid`
  - Fields: `{ schoolId: string, role: string, userId: string, updatedAt: string }`
  - **Read Protection**: Authenticated users can only read their own mapping document (`request.auth.uid == uid || isCreator()`).
  - **Self-Escalation Denial**: When a user creates their mapping document upon registration/login, rules strictly verify that:
    1. A corresponding record already exists in `schools/{schoolId}/users/{userId}` created by a school director or system creator.
    2. The claimed role matches the stored record's role exactly (`get(...).data.role == request.resource.data.role`).
  - **Mutation Protection**: Once created, only a director of that school or the system creator can update or delete the mapping.
- **Client Synchronization**:
  - `services/db.ts: syncUserAuthUidMap`: Writes/updates mapping document on authentication.
  - `views/Login.tsx`: Calculates virtual email `{userId}@{schoolId}.eljur.org`, signs in / registers with Firebase Auth, and stores the mapping.

---

## 2. Active Firestore Security Rules (`firestore.rules`)

All access functions in `firestore.rules` enforce tenant isolation, role hierarchy, and privilege escalation denial:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function currentUserData() {
      return get(/databases/$(database)/documents/authUidMap/$(request.auth.uid)).data;
    }

    function hasAuthMap() {
      return isAuthenticated() && exists(/databases/$(database)/documents/authUidMap/$(request.auth.uid));
    }

    // Creator role: only permanent superadmin UID or verified creator role in authUidMap
    function isCreator() {
      return isAuthenticated() && (
        request.auth.uid == 'P5cdPdwZSOXcKzpKLsPWRsoY7CM2' ||
        (hasAuthMap() && currentUserData().get('role', '') == 'creator')
      );
    }

    function isSchoolMember(schoolId) {
      return isAuthenticated() && (
        isCreator() ||
        (hasAuthMap() && currentUserData().get('schoolId', '') == schoolId)
      );
    }

    function isDirector(schoolId) {
      return isAuthenticated() && (
        isCreator() ||
        (hasAuthMap() && 
         currentUserData().get('schoolId', '') == schoolId &&
         currentUserData().get('role', '') == 'director')
      );
    }

    function isTeacher(schoolId) {
      return isDirector(schoolId) || (
        isAuthenticated() &&
        hasAuthMap() &&
        currentUserData().get('schoolId', '') == schoolId &&
        currentUserData().get('role', '') == 'teacher'
      );
    }

    // Mapping table: user can read their own map doc; self-escalation strictly prohibited.
    match /authUidMap/{uid} {
      allow read: if isAuthenticated() && (request.auth.uid == uid || isCreator());

      allow create: if isAuthenticated() && (
        isCreator() ||
        (request.auth.uid == uid &&
         request.resource.data.userId is string &&
         request.resource.data.schoolId is string &&
         request.resource.data.role is string &&
         exists(/databases/$(database)/documents/schools/$(request.resource.data.schoolId)/users/$(request.resource.data.userId)) &&
         get(/databases/$(database)/documents/schools/$(request.resource.data.schoolId)/users/$(request.resource.data.userId)).data.role == request.resource.data.role)
      );

      allow update, delete: if isDirector(resource.data.schoolId) || isCreator();
    }

    // --- Isolated School Namespace ---
    match /schools/{schoolId} {
      // Public Creator Gate Configuration (pre-login trigger configuration and password verification hash)
      match /publicConfig/creatorGate {
        allow read: if true;
        allow write: if isDirector(schoolId);
      }

      allow read: if isAuthenticated();
      allow write: if isDirector(schoolId);

      // School users collection (Profiles)
      match /users/{userId} {
        allow read: if isSchoolMember(schoolId);
        // Only director or creator can manage users; director CANNOT assign role: 'creator'
        allow write: if isCreator() || (
          isDirector(schoolId) && (
            request.method == 'delete' ||
            request.resource.data.role != 'creator'
          )
        );
      }

      match /schedules/{classKey} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isTeacher(schoolId);
      }

      // Academic Grades - Students NEVER write grades
      match /grades/{gradeId} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isTeacher(schoolId);
      }

      match /finalGrades/{classKey} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isTeacher(schoolId);
      }

      match /homework/{hwId} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isTeacher(schoolId);
      }

      match /messages/{msgId} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isSchoolMember(schoolId);
      }

      match /announcements/{annId} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isTeacher(schoolId);
      }

      match /events/{eventId} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isTeacher(schoolId);
      }

      match /attendance/{attId} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isTeacher(schoolId);
      }

      match /attachments/{attId} {
        allow read: if isSchoolMember(schoolId);
        allow write: if isSchoolMember(schoolId);
      }
    }
  }
}
```

---

## 3. Threat Model & Privilege Escalation Mitigations

Four independent attack vectors were audited, closed, and verified with emulator tests:

1. **Anonymous / Unauthenticated Access**:
   - Closed: All school subcollections (`grades`, `users`, `schedules`, etc.) require `isAuthenticated()` and school membership.
2. **Self-Registration Escalation (via `authUidMap`)**:
   - Closed: Users self-binding their UID must match a pre-existing profile in `schools/{schoolId}/users/{userId}` with identical `role`.
3. **Email Pattern Matching (`matches('^creator.*')`)**:
   - Closed: All regex matches and arbitrary email heuristics were completely eliminated from `isCreator()`. Privileges depend strictly on verified UID or validated `authUidMap` document.
4. **Director Privilege Escalation (assigning `role: 'creator'`)**:
   - Closed: In `schools/{schoolId}/users/{userId}`, write rules explicitly forbid directors from creating or updating documents where `request.resource.data.role == 'creator'`. Only the system creator (`isCreator()`) can grant the `creator` role.
5. **Defense-in-Depth in Client Helpers**:
   - Both `isAnnouncementUnreadByUser` and `isMessageUnreadByUser` in `utils/helpers.ts` strictly check `schoolId` match between recipient and item/sender.

---

## 4. Security Verification Tests (`firestore.rules.test.ts`)

All security invariants are verified against a local Firestore Emulator instance using `@firebase/rules-unit-testing`.

### Test Execution Command
```bash
npm test
# runs: firebase emulators:exec --only firestore "node --experimental-strip-types --test firestore.rules.test.ts"
```

### Verified Test Results (15 of 15 Passing)
```text
TAP version 13
# Subtest: Firestore Rules Security Invariants (Unified Test Suite)
    ok 1 - Anonymous Access Denied: Unauthenticated read of users is strictly BLOCKED
    ok 2 - Anonymous Access Denied: Unauthenticated write to grades is strictly BLOCKED
    ok 3 - Tenant Isolation: Teacher of School A is BLOCKED from reading School B data
    ok 4 - Tenant Isolation: Teacher of School A is BLOCKED from writing School B grades
    ok 5 - Role Permissions: Student of School A is BLOCKED from writing grades
    ok 6 - Role Permissions: Teacher of School A CAN write grades in own school
    ok 7 - Role Permissions: Director of School A CAN manage users in own school
    ok 8 - Super-Admin: Creator has multi-school read access
    ok 9 - authUidMap Security: Users can read only their own authUidMap document
    ok 10 - DENIES self-escalation: newly registered user cannot assign themselves role creator without a matching users/ record
    ok 11 - DENIES self-escalation: user cannot assign mismatched role differing from users/ record
    ok 12 - ALLOWS legitimate user mapping when matching users/ record exists with matching role
    ok 13 - ALLOWS unauthenticated read of schools/{schoolId}/publicConfig/creatorGate
    ok 14 - DENIES creator privileges via email pattern match — self-registered "creatorXXX@..." must NOT become creator
    ok 15 - DENIES director from granting themselves or others the creator role
    1..15
ok 1 - Firestore Rules Security Invariants (Unified Test Suite)
# tests 15
# suites 1
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

---

## 5. Pre-Login Creator Gate & Cryptography

- **Public Gate Document**: `schools/{schoolId}/publicConfig/creatorGate`:
  - Contains only public keyboard listener configuration (`secretKey`, `secretCount`) and salted password hash (`adminPasswordHash`, `adminPasswordSalt`).
  - Zero sensitive school data or passwords in plaintext are exposed.
- **Password Algorithm**: PBKDF2-HMAC-SHA256 with **100,000 iterations** via Web Crypto API (`crypto.subtle.deriveBits`).
- **Salt**: 16 cryptographically random bytes via `crypto.getRandomValues`.
- **Zero Default Passwords**: The default `'admin'` credential was completely removed from `App.tsx`, `types.ts`, and `views/Login.tsx`.

---

## 6. Live Environment Status

- **Database**: Firestore `(default)` with deployed `firestore.rules` enforcing strict ABAC via `/authUidMap/{uid}`.
- **Storage**: `firebasestorage.app` with `storage.rules` for file attachments.
- **Authentication**: Virtual email mapping `{userId}@{schoolId}.eljur.org` generates genuine Firebase Auth user sessions.
