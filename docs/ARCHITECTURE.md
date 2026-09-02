# Benkut architecture and operations

## Original application audit

The starting application is a Vite/React 19 TypeScript single-page application using hash routing and Tailwind's browser CDN. `App.tsx` owns navigation and a demo admin-auth state. The user experience consisted of recipe discovery, history/support screens, and a full-screen Chef session. `CookingSession.tsx` directly creates a `@google/genai` Live session, streams 16 kHz microphone PCM, plays 24 kHz audio, sends camera captures through two Gemini function calls, and selects a cuisine-specific voice. `geminiService.ts` supplies non-live chat. Model names and keys were embedded at the client adapter boundary. The Firebase service was a console-only mock: no Firebase package, Authentication session, Firestore writes, Storage use, Cloud Functions, rules, or existing persistent collections were present. Preferences existed only in UI/admin configuration; recipes are static service data.

Retained components are the complete Chef audio/video/session UI, recipe service, Gemini SDK, router, tracking consent, and visual system. Chef is wrapped with a narrow, read-only Food Memory context; its live transport is not replaced.

## Implemented foundation

`domain/foodMemory.ts` defines lot inventory, meals, shopping, explicit versus hypothesised preferences, and immutable event records. `foodMemoryService.ts` is the controlled mutation boundary: it validates actor/household/idempotency metadata, uses use-first lot ordering, emits one event per retry-safe mutation, and keeps eating separate from consumption and carts separate from purchases. The browser adapter is an offline projection for this prototype; production deployment must replace its persistence methods with Firestore transactions while retaining the interface and event contract. Gemini receives task-scoped, read-only context and cannot write arbitrary objects.

`agentOrchestrator.ts` provides the common response envelope, intent routing, the named bounded tools, deterministic unit-price/allergen-ready evaluation boundaries, and the deliberately inactive `CommerceProvider`/`VendorIntegrationAdapter` (`status: future`). My Food and Fresh are unified routes alongside the preserved Chef.

## Firestore deployment model

Collections are `users/{uid}`, `users/{uid}/private/profile`, `households/{hid}`, `members`, `memory/current`, `foodEvents`, `pantryItems`, `pantryLots`, `mealLogs`, `shoppingLists/{list}/items`, `storeEvaluations`, `carts/{cart}/items`, `purchases/{purchase}/items`, and `cookingSessions`. The three composite indexes cover active lots by expiry, meals by user/time, and events by actor/time. Rules require authentication and membership, restrict mutation to owner/editor roles, bind event actors to Auth, and make events immutable. Storage is household-scoped and limited to 10 MB per object.

## Migration

1. Deploy new rules/indexes first; do not delete legacy Chef data.
2. Create a household and active owner membership for every existing user; set `users.defaultHouseholdId`.
3. Backfill old preferences as explicit facts only when user-authored; otherwise add unconfirmed hypotheses with `source=migration`.
4. Map old Chef session references into `cookingSessions.existingChefSessionReference`; never duplicate recipe records.
5. Write deterministic `migration-v1:<legacy-id>` idempotency keys and immutable source events. Run in batches and record the last cursor.
6. Verify projections, then enable shared-memory reads. Rollback disables new reads; legacy records remain untouched.

## Configuration and deployment

Required server runtime variables are listed by name in `.env.example`; none are exposed through Vite. Configure Firebase Authentication providers, register web App Check, enable Firestore/Storage, and select an appropriate media-retention lifecycle policy. All Gemini and Live authorization now fail closed through the BFF until its trusted provider and Firebase token-verification adapters are configured.

Run the consumer with `npm run dev` and the BFF with `npm run server`. Build with `npm run build`. Deploy rules and indexes with `firebase deploy --only firestore:rules,firestore:indexes,storage`, then deploy the generated `dist` and server separately through the project's hosting pipeline.

## Known limitations

The repository had no Firebase SDK dependency and package installation is blocked in this environment; therefore the included client persistence adapter uses local storage/offline events and is not an authoritative production Firestore implementation yet. The BFF provides tested policy/security primitives but its Firebase Admin, App Check, Secret Manager, Firestore transaction and Gemini provider adapters must be connected before pilot deployment. Fresh scan buttons are interaction surfaces, not OCR/barcode pipelines; receipt processing, export/deletion jobs, authoritative allergen/recall sources, background sync, haptics, live Fresh video and emulator suites remain integration work. Food-safety wording is intentionally conservative. The Chef audio/video implementation is retained, but secure Live now intentionally fails closed until server-issued provider authorization is configured; confirmed post-cooking writes still require product UI wiring.
