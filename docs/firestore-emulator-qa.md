# Firestore Emulator QA

The QA commands are pinned to the synthetic Firebase project
`demo-thai-music-editor`. They do not deploy rules or write production data.

## Prerequisites

- Node.js 20 or newer (the installed rules-testing package requires Node 20+).
- A Java JDK available on `PATH`. Firebase currently documents JDK 11 as the
  minimum and recommends moving to Java 21 for current/future Firestore
  emulator releases.

Verify the prerequisites in a new terminal:

```powershell
node --version
java -version
```

## Commands

Run the rule policy suite only:

```powershell
npm run firebase:rules:test
```

Run rules plus migration, aggregate, concurrency, failure/retry, quota, and
real `.tme` compatibility QA:

```powershell
npm run firebase:qa
```

Run the complete repeatable release gate (targeted lint, unit tests,
production build, then emulator QA):

```powershell
npm run firebase:release-check
```

Start Firestore and Authentication emulators for interactive local app QA:

```powershell
npm run firebase:emulators
```

In an uncommitted `.env.local`, explicitly enable the local connection:

```dotenv
VITE_USE_FIREBASE_EMULATOR=true
```

Then start Vite in another terminal. Emulator mode uses dummy Firebase config,
skips Analytics initialization, and connects Firestore/Auth to localhost. The
flag is ignored by production builds because the connection is dev/test-only.

## Expected behavior without an emulator

`npm test` discovers the 20 emulator cases but marks them skipped when
`FIRESTORE_EMULATOR_HOST` is absent. This prevents an ordinary test run from
falling through to production Firestore.
