# Security Specification: ElZhur

Since the application utilizes a custom in-app authentication schema inside a singular `appStates/main` JSON document and currently leverages no Firebase Authentication for its end users, strict RBAC attribute-based access control inside Firestore Rules is not structurally feasible.

## 1. Data Invariants
- The system depends on `appStates/main` being accessible to all connected clients running the application.
- Authentication happens on the client-side parsing the state payload, not at the database layer.

## 2. The "Dirty Dozen" Payloads
_Not applicable due to `default: true` architecture necessitated by legacy state sync._

## 3. Test Runner
Because the rules currently allow public read/write to the state document, a standard test runner verifying `PERMISSION_DENIED` is fundamentally at odds with the architecture.
