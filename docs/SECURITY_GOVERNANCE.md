# Benkut security, governance, privacy and pilot operations

## Trust boundaries and threat model

The browser is untrusted. Gemini, prompt/RAG retrieval, quota reservation, media normalization, sensitive aggregation, administrative changes, export and deletion run only in the BFF. Firebase Auth identifies users; App Check attests clients; server authorization and Security Rules independently enforce access; IAM limits service accounts. This is an alignment target—not a claim of OWASP, ISO, SOC 2, NIST, DPDP, GDPR, CIS, or WCAG certification.

| Threat | Primary controls |
|---|---|
| Account takeover, admin escalation | Firebase ID-token verification, MFA/custom claims, recent reauthentication, 15-minute idle/8-hour absolute admin sessions, five-attempt lockout, revocation and device audits |
| Broken access control, IDOR, cross-household access | Server authorization on every object, membership rules, opaque IDs, negative emulator tests |
| API-key/secret leakage | server-only Secret Manager access, no Vite secret prefixes, fail closed, secret scan and rotation |
| Prompt injection, RAG poisoning, prompt exfiltration | separate immutable prompts, approved/active source allowlists, instruction isolation, agent/jurisdiction/language filters, bounded chunks, no tools from retrieved text |
| Malicious media, XSS, CSRF, SSRF, injection | short-lived private uploads, magic-byte/MIME validation and normalization, size/duration bounds, CSP/output encoding, strict CSRF/CORS, URL allowlists, parameterized repositories |
| Replay/quota bypass, agent loops, model DoS | idempotency, transactional reservation/reconciliation, IP/device/account limits, recursion/tool/handoff/time bounds, duplicate/cycle detection, kill switches |
| Sensitive logs/data exfiltration | structured redacted logs, no raw media/prompts/tokens, purpose-limited context retrieval, field encryption for sensitive profiles |
| Dependency/supply-chain compromise | lockfile, least-privilege CI, audit/SAST/secret scanning, pinned reviewed deployment artifacts |

## Administrator bootstrap and permissions

The bootstrap job reads `BENKUT_ADMIN_EMAIL` and `BENKUT_ADMIN_BOOTSTRAP_PASSWORD` from Secret Manager, creates/locates the Firebase user, assigns `admin:true, role:super_admin, mfa:false, passwordChangeRequired:true`, and writes an audit event. First login requires password replacement and MFA enrollment; then set `mfa:true`, revoke old tokens, disable/rotate bootstrap password, and never reuse it. Admin APIs verify tokens server-side and never trust roles in request bodies. Cookies are `Secure`, `HttpOnly`, `SameSite=Strict`; state changes require CSRF tokens. Sensitive actions require a token auth time within five minutes and a reason.

| Role | Scope |
|---|---|
| super_admin | all controls and role assignment |
| security_admin | security, incidents, revocation, audit |
| agent_governance_admin | agents, model/tool/safety policies and quotas |
| prompt_admin | prompt draft/test/stage/publish/rollback |
| rag_content_admin | RAG ingest/review/approval/retirement |
| operations_admin | health, incidents and expiring overrides |
| support_readonly | masked account/consent/quota summaries only |
| audit_readonly | append-only audit views only |

No silent impersonation exists. Sensitive-data access requires an elevated role, recent authentication, recorded reason and audit event. Audit fields are administrator ID/role, action, target type/ID, before/after hashes, reason, timestamp, privacy-preserving network ID, session ID, outcome and correlation ID; secret values, raw tokens and decrypted content are prohibited.

## Quotas and usage

`pilot-v1` in `server/policies.mjs` contains all initial limits. A trusted transaction reserves capacity before provider contact and reconciles actual billed tokens/media/cost after completion. Idempotent retries return the same reservation. Records use `users/{uid}/usageBuckets/{UTC-date}`, `agentSessions/{sessionId}`, server-only usage events, and `system/rateLimitPolicies/{id}`. Usage captures uid, household, agent, modality, model, session/interaction, recursion, tokens, seconds, images, cost, outcome, billed flag, policy version, timestamp and idempotency key. Public quota errors reveal only the reached limit, current/max values, UTC reset, exception presence and non-AI alternatives.

IP bursts, device signals, account concurrency, agent/model/project cost ceilings, anomaly suspension and overrides sit in the same server enforcement chain. Budget alerts fire at 50/75/90/100%. The emergency procedure is: authenticate with MFA and recent reauth; record incident/reason; enable project, agent, modality or model kill switch; revoke active reservations/Live authorizations; notify users with maintenance fallback; investigate; stage recovery; restore gradually; close with an immutable audit event.

## Languages and translations

The seed matrix contains 31 BCP-47 candidates but enables none until current official documentation is verified against the configured server model. Each registry record independently controls input/output text, Live, transcription, TTS and code-switching. Text can remain enabled when Live is not. Interface resources live in `i18n/`; interface and conversation language are distinct and persisted. Household-member preferences belong in their member document. Automatic detection may update conversation language only when unlocked and confidence is adequate.

Safety translations store original and translated strings, model/provider/timestamp provenance, confidence and review state. Low-confidence allergens, dates, warnings, prices, quantities and measurements require confirmation. Admins review safety translations; locale APIs format numbers, currency, dates and units. Transliteration is optional presentation metadata, never a replacement for original text.

## Prompt and RAG governance

Every agent has a separate definition and prompt version. Lifecycle is Draft → Validate → Test → Review → Stage → Publish → Monitor → Roll back/Retire. Published prompt documents are immutable and contain hash, languages, model/tool/RAG/safety/output policies, actors, timestamps, reason, parent and evaluations. Only server identities retrieve prompt content.

RAG corpora are the 16 domain collections named in the product specification. Documents store official source metadata, jurisdiction/language/topic, agent allowlist, dates, version/hash, approval, sensitivity and citation requirements. Only approved, active, unexpired documents pass document, agent, jurisdiction, language and source filters. Content is sanitized and instruction-like text is isolated/rejected. Retrieval returns at most eight ~700-token chunks with provenance. Corpus versions can be staged, tested, monitored, rolled back and retired.

## Privacy and retention

| Data | Default retention | Control |
|---|---|---|
| Temporary scan media | extraction completion or 24 hours | private object + deletion job |
| Live audio/video | not retained | streaming only |
| Approved receipt/label media | feature need/user setting | private household object |
| Derived pantry/purchase data | user setting/legal need | export/correct/delete workflows |
| Admin/security audit | security-policy period | append-only, no food/conversation payload |
| Usage/cost metadata | operations-policy period | pseudonymized reporting |

Explicit capture and model-improvement consent are separate. Media uses short-lived authorization, content-derived MIME checking, normalization/metadata stripping, malformed/executable rejection, bystander redaction where practical, and deletion of processing files. Retention is policy-versioned and admin-configurable.

## Secrets and rotation

Secret inventory (names only): `GEMINI_API_KEY`, `BENKUT_ADMIN_EMAIL`, `BENKUT_ADMIN_BOOTSTRAP_PASSWORD`, `BENKUT_ADMIN_SESSION_SECRET`, `BENKUT_FIELD_ENCRYPTION_KEY`, Firebase project/bucket runtime configuration, and external provider secrets actually enabled. Use AI Studio Secrets in development and Secret Manager with secret-level `secretAccessor`, workload identity, versioning and Cloud Audit Logs in production. Rotation: create version; stage with dual-read where supported; validate; promote; revoke sessions/tokens if relevant; disable old version; audit; verify rollback. Missing secrets fail closed.

## Deployment checklist

Development: isolated Firebase project, emulator rules tests, AI Studio secrets, local BFF, test accounts, no production data. Staging: separate project/service accounts, App Check enforcement rehearsal, current model-language verification, quota/load/security/accessibility tests, backup restore and incident drill. Production: reviewed rules/indexes/headers, Secret Manager/IAM, TLS/custom domains (`admin.benkut.com` as separate Hosting target), App Check enforced, MFA/bootstrap rotated, budgets/alerts/kill switches, retention/export/deletion jobs, monitoring and rollback artifact. Run dependency, static, secret, header, CORS/CSRF, malicious-media, cross-household, audit-integrity and Chef regression suites before promotion.

## Design token and accessibility audit

The retained visual language uses sunny yellow `#FDE047`, herb green `#15803d`, warm stone neutrals, Plus Jakarta Sans/Space Grotesk, Material Symbols, 12–32px radii, generous 8px-derived spacing, bordered white cards, and large circular live controls. Shared CSS variables/classes now formalize cards, controls, focus, status and reduced motion. Consumer screens remain mobile-first; admin is desktop-first. Controls target at least 44px, have visible keyboard focus, semantic labels, non-color status text and reduced-motion behavior. Automated browser contrast/keyboard/screen-reader and before/after visual snapshots remain a release-gate item because no browser binary is available in this environment.
