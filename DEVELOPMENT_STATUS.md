# Development status

Updated: 14 November 2026

## Implemented in this pass

- Applied the monochrome, geometric, electric-blue and emerald visual system across the dashboard, attendance, and every activated portal area.
- Replaced swipe-only mobile primary navigation with a compact native disclosure menu; all screen links stay in the desktop sidebar and are available from the phone menu, which closes after navigation.
- Added account-scoped removal for manual assignments, with confirmation and related alarm/task cleanup; synchronized assignments remain read-only.
- Device-only assignment status changes stay local without sending a PATCH for a nonexistent account record.
- Device-only Directed Reading and backlog status changes now stay local; account-backed rows keep API status updates.
- Directed Reading and backlog lists label each record as account-backed or device-only.
- Replaced the build-time Google Fonts fetch with a premium system-font stack and pinned Next output tracing to this project root, allowing production builds without external font access or parent-folder lockfile confusion.
- Improved the global alarm dialog for keyboard and assistive technology use: it receives initial focus, contains Tab navigation, makes the portal inert while open, and restores prior focus when closed.
- The immersive alarm now refreshes its displayed local time every 15 seconds while active.
- Assignment queue cards and calendar day entries show whether each item is saved to the account or exists only on this device.
- Calendar date controls expose their selected state and announce when a date has an active assignment deadline.
- Assignment titles wrap within queue cards and calendar entries on narrow viewports, including long unspaced titles.
- Assignment deletion now adds a per-account, same-session tombstone; if browser storage rejects the delete, stale rows remain hidden across portal navigation and the global alarm scheduler suppresses the removed reminder. Successful account reloads discard stale cached account rows instead of presenting them as device-only records.
- Added responsive screens for academic performance, assignments, calendar, policy reference, Directed Reading, backlogs, placement readiness, notifications, and student settings.
- Kept the existing attendance calculation engine, dashboard sample labeling, mock connector labeling, email sign-in, backend auth, API contracts already in use, and Prisma schema. The `Student.degree` field is unchanged and is editable through settings.
- Added weighted assessment, required remaining assessment score, credit-weighted GPA, CGPA projection, and placement-check calculation helpers with critical calculation tests.
- Added authenticated `PUT /v1/me` profile saving; student-scoped assignment create/list/status/delete (delete is limited to manual assignments and removes associated alarms/tasks); Directed Reading create/list/status; backlog create/list/status; notification-preference read/save; and transcript-payload academic record list/save endpoints, all using existing repository interfaces and Prisma tables.
- Added API tests for profile validation/save, student-isolated assignment create/status/delete, Directed Reading/backlog records, notification preferences, transcript snapshots, authenticated policy search and answer behavior, and empty verified-placement retrieval, plus core calculation and retrieval tests.
- Connected the calendar to account assignments and made placement analysis prefill CGPA from saved semester courses and active backlog count from account records when available.
- Hardened placement calculation inputs so invalid percentages or fractional backlog counts cannot produce an eligibility result.
- Matched assessment weight validation in the calculator to the existing API schema (0–100) so entries accepted locally can also be saved.
- Corrected attendance subject labels and dashboard provenance to distinguish account records from development sample data.
- Dashboard and Attendance now distinguish sample-only, account-only, and mixed attendance responses; mock rows are individually marked as sample and the mixed state warns that those rows are not official UPES records.
- Attendance rows with missing or unsupported provenance now display an explicit “Unverified source” badge in the dashboard and attendance subject selector.
- The global alarm runner now loads account notification preferences before scheduling reminders, so quiet hours and saved offsets apply when a signed-in student opens directly to any page.
- Dashboard and Attendance now clear account-specific profile/counts on sign-out, reload on initial/sign-in auth events, and discard stale in-flight responses so a previous session's attendance cannot stay visible.
- The shared account control now ignores a stale initial session lookup after an auth event, so a delayed response cannot restore the previous account email/sign-out control after sign-out.
- Local assignment, calendar, academic calculator, backlog, Directed Reading, and notification data is scoped by the authenticated user ID; views stay empty/default until the current account's saved state has loaded, preventing previous-account browser data from flashing or being overwritten after a session switch. Settings loads and saves the authenticated profile with the preserved degree field and discards responses after an account change.
- Academic transcript semester lists now reload per authenticated account, and semester save/load actions stay disabled until that account's transcript list and local calculator state have hydrated; in-flight transcript requests cannot update the next account's view.
- Placement Readiness clears prior account-derived CGPA/backlog values and its editable percentage field when the authenticated account scope changes, then reloads the new account's records.
- Account-scoped local setters now reject writes until the current storage scope has hydrated. Academic, Directed Reading, backlog, policy, and notification controls wait for that state; policy search results and notification preferences are hidden during account changes and stale policy responses are discarded.
- Directed Reading and backlog list hydration now merges against current state rather than an old render snapshot, preserving a record added while the list request is in flight; write/status controls wait for the initial list request to settle.
- Unsaved form drafts are cleared when the account scope changes in assignments, academic calculators, policy sources, placement criteria, Directed Reading, and backlog tracking.
- Preserved overdue assignment status across the API and assignment screen; it can now be viewed and updated without being silently converted to Open.
- Backlog create now refreshes its displayed details from the server response, so duplicate course submissions reflect the account's canonical record instead of the newly entered values; API coverage asserts duplicate requests do not create a second backlog.
- Browser notifications are stored under the existing `local` preference channel instead of `web_push`, because delivery is local to an open tab; older saved `web_push` preferences are still recognized.
- Notification offset input now validates the same 1–43,200 minute and 10-entry limits as the API before saving; blank offsets explicitly disable automatic reminders. Assignment scheduling uses the same parser so malformed local edits cannot be partially scheduled. Parsing is shared in the core package and has edge-case tests.
- Browser notification enable/test actions now report unsupported browsers and denied permission instead of silently doing nothing.
- The Assignments permission action now reports unsupported browsers, denied permission, and permission API failures; notification constructor failures no longer prevent the in-app alarm dialog from opening.
- Notifications permission requests and test delivery now also catch browser-context failures and report next steps. Attendance sign-out resets all simulator controls to the labeled sample defaults.
- Assignment, Directed Reading, and backlog queues now distinguish initial loading from an account with no records, so loading does not look like lost data.
- The selected-day calendar panel also reports deadline loading before showing its empty-day message.
- Notifications now shows the next five future alarms from the current account's assignments plus device-only reminder metadata, with a loading state and a real empty state; alarm management links to the assignment screen.
- Dismiss and snooze now apply their reminder-sequence edits against current assignment state, and the notification queue refreshes every 30 seconds so passed reminder times drop out without requiring navigation.
- Moved alarm polling and the dark alarm dialog into the application shell, so reminders continue across portal pages while the tab remains open; snooze/dismiss writes update the Assignments screen through a same-tab event.
- The global scheduler validates reminder records and timestamps before polling, so malformed device storage cannot trigger an invalid alarm or stop the polling loop.
- Alarm de-duplication now falls back to in-memory state when browser session storage is blocked, so privacy settings cannot prevent an alarm from appearing.
- Local-storage writes across the shared feature workspace now fail safely instead of crashing the screen. Assignment feedback distinguishes account saves from device-only reminder persistence and session-only fallback when browser storage is blocked.
- Browser-cached student lists, assignments, assessment scores, and course grades are shape-checked on load; malformed or stale cache rows are ignored instead of reaching UI render and calculation code.
- Academic, policy, placement, Directed Reading, and backlog screens now report when browser storage is blocked, distinguishing local-only persistence from account records that still save through the API.
- Assignment, Directed Reading, Backlog, assessment, and course-name form limits now match the existing API schema; text is trimmed before submission and whitespace-only required values are rejected before falling back to local storage.
- Student Settings trims and validates the required name/student ID fields before the profile API save.
- Placement criteria only render source URLs as clickable external links when they use HTTP or HTTPS; other stored text is displayed without an active link.
- New assignments without a manual alarm now store all future configured offsets on the device and schedule the first. Dismiss and snooze interactions advance the local sequence; critical calculation tests cover offset ordering.
- Added ranked local policy passage retrieval with version/URL citations and a no-result state that does not invent an answer; retrieval tests cover ranking and citation metadata.
- Added authenticated `/v1/policies/search` over existing `PolicyChunk` / `PolicyDocument` tables; results omit documents without source URLs, superseded documents, and documents not yet effective. The screen combines account results with local saved excerpts.
- Added `/v1/policies/answer` and an optional server-side OpenAI Responses API adapter. Answers use retrieved evidence, request numbered citations, and are not generated when evidence is empty or the provider is unconfigured/unavailable. Local excerpts are sent only after the student opts in; provider keys remain server-side. Added API tests for configured grounded answers, no-provider/no-opt-in behavior, opt-in local-source inclusion, and excerpt-size validation.
- Limited policy answer requests to 10 per minute per client with a bounded request body; added API coverage for the rate limit.
- Added optional `OPENAI_API_KEY` plus `OPENAI_MODEL` API configuration and documented the server-side setup and local-excerpt consent behavior.
- Added authenticated `/v1/placement/rules` over existing placement/policy tables; results require a verified rule linked to a current, sourced document and are batch-filtered when the student has a batch. The analyzer combines these with device-saved student criteria.
- Added `NEXT_PUBLIC_API_URL` configuration and updated setup/integration documentation.

## Current behavior and scope limits

- Profile, assignment, Directed Reading, and backlog records and notification preferences can persist through the API. Without Supabase credentials/API authentication the feature screens retain browser-local fallbacks as described in the UI.
- Assignment reminder times, sequence, and priority are stored in browser local storage. A new assignment with a deadline uses all future configured offsets unless an explicit alarm is set; dismissing or snoozing advances the sequence. Quiet hours can defer the alarm dialog while the portal is open; the global reminder runtime checks browser notifications and displays the dark alarm dialog across portal pages. Alarms stop when the tab closes.
- Assessment/course calculator entries remain browser-local during editing; saved semester snapshots persist to the existing `Transcript.payload` through the API. The calendar now loads account assignments when available and merges device-only assignment/reminder metadata; local-only assignment entries remain on that device. User-authored policy excerpts and placement criteria remain browser-local; curated policy chunks and verified sourced placement rules can load from APIs. Browser alarm times and notification permission are device-local. Assignment alarms hydrate account quiet-hour, browser-delivery, and reminder-offset preferences when available.
- The policy screen ranks stored chunks and user-provided text with citations. Generated answers require the deployment to configure a working OpenAI API key/model; no credentials were available here to exercise live generation. There is no admin ingestion workflow, source-domain verification, or semantic embedding generation.
- Grade calculations do not encode official UPES grade boundaries. Database placement rules must be marked verified and linked to a current document; the portal does not independently validate the publisher. User-entered thresholds remain personal planning estimates.
- No Expo application, background push delivery, or native exact-alarm support exists in the supplied codebase. No native project was added.
- No live Supabase/Postgres instance or approved UPES/Moodle integration credentials were available to verify production persistence or official sync.

## Final audit checklist

### Implemented and verified in this pass

- [x] Directed Reading and backlog lists load account records from authenticated APIs, preserve device-only records, label each row's storage scope, and update status locally or through the matching account endpoint.
- [x] Placement Readiness loads account transcript courses and active backlogs where available, supports sourced rules, and returns `unknown` unless thresholds are verified and required student inputs are present.
- [x] Academic records validate assessment payloads, calculate semester GPA from entered course credits/grade points, and save/load semester snapshots through the authenticated transcript API.
- [x] Assignment, calendar, notification, settings, placement, Directed Reading, Backlogs, and academic screens call existing API routes where implemented; local-only state is labeled.
- [x] The global alarm runner hydrates account notification preferences before scheduling and prevents stale preference responses after unmount or account changes.
- [x] `npm ci` completed in an isolated copy; Prisma Client was generated without changing the schema. `npm test` passed 54 tests (29 API, 25 core), and `npm run typecheck` passed all workspaces.
- [x] `npm run build -w @upes/web` completed: dashboard, attendance, login, shared app routes, and static pages compiled and generated.
- [x] The academic-record Prisma repository imports its Zod schema as a runtime value, and the alarm dialog's focus-trap callback uses a non-null narrowed element.
- [x] Phase 1 Prisma schema, auth plugin, and original route handlers remain unchanged relative to the supplied archive. `git diff --check` passes; all 39 TypeScript/TSX sources parse.

### Incomplete or not verified

- [ ] Browser-rendered responsive QA at mobile, tablet, and desktop sizes, plus interactive keyboard checks, was not run. The API and web servers started in the isolated copy, but separate command sessions cannot reach their localhost ports in this sandbox.
- [ ] Live Supabase/Postgres persistence and multi-account isolation were not verified against real services or credentials. API tests use in-memory dependencies.
- [ ] UPES data sync is explicitly a development mock; Moodle sync is not implemented. Neither is presented as an official integration.
- [ ] Policy retrieval requires an ingested source corpus. Generated policy answers additionally require configured OpenAI credentials; live generation and source authority were not verified.
- [ ] Placement rules must come from a current, linked source. Manually entered thresholds are user-asserted planning criteria, not official eligibility decisions.
- [ ] Assignment alarms and browser notifications require the portal tab to remain open. Closed-tab push delivery, native exact alarms, and Expo are not implemented; the repository contains no Expo workspace.
- [ ] `npm ci` reported 12 dependency audit findings (4 moderate, 6 high, 2 critical). No automated dependency upgrades were applied; review `npm audit` output before deployment.

The complete web MVP is implemented. The unchecked items above require a browser/runtime, external service credentials, official source material, or a separate native/push implementation; they are not represented as completed integrations.

## UI refresh (19 November 2026)

- Refined student-friendly sidebar with lightweight inline icons and clearer navigation.
- Added dashboard semester snapshot and quick actions while preserving existing attendance logic.
- Added root Vercel configuration and `VERCEL_DEPLOYMENT.md`.
- No official UPES integration is claimed; mock/sample data remains explicitly labelled.
