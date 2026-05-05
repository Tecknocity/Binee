# Phase 2 - Intent Classifier Info-Only Mode

First phase where users see different behavior. Strictly additive: turns the
classifier marks `info` (with confidence >= 0.6) route to the new Info Handler
instead of the Clarifier or Reviser. Everything else continues to use the
existing isReadyDraft routing.

## Activate

1. Vercel -> Settings -> Environment Variables -> edit `SETUP_INTENT_CLASSIFIER`
2. Toggle Sensitive off
3. Set Value to: `info_only`
4. Save
5. Deployments -> latest -> ... -> Redeploy
6. Wait for redeploy to finish

## Verify

Send one info-style message in production setup chat (e.g., "what's my
industry?"). In Vercel logs filter on `[setup-intent]`. The line should show:

- `"mode":"info_only"`
- `"intent":"info"`
- `"routedTo":"info"`
- `"legacyWouldHavePicked":"clarifier"` or `"reviser"` (the disagreement is the whole point)
- `"messagePreview":"what's my industry?"`

If you see `routedTo:"clarifier"` instead of `"info"` on a clear info question,
either the classifier confidence was below 0.6 or fallbackUsed was true. Check
those fields on the same line.

## Manual QA scenario suite

Run all 11 scenarios in order on at least 2 fresh test accounts. Do not skip
any.

### Setup before testing

- Fresh test account or reset workspace
- Profile: industry = Marketing Agency, team size = 1, work style = client-based
- Connect ClickUp to a workspace that has at least 1 space and 2-3 lists already
- Get to Step 2 (Business Chat)

### Scenario A - Pure discovery (Clarifier sanity check)

Type: `I run a small marketing agency, mostly content and social campaigns`

- Expected log: `intent=discovery`, `routedTo=clarifier`
- Expected UI: Generate Structure button NOT highlighted yet
- PASS: AI's response is a follow-up discovery question relevant to your message
- FAIL: AI re-asks "tell me what your work is" (would mean prior answer was lost)

### Scenario B - Info question (the bug we're fixing)

Type: `Can you tell me what structure I currently have in ClickUp?`

- Expected log: `intent=info`, `routedTo=info`
- Expected UI: "What I've gathered" panel still shows whatever was there before (NOT cleared)
- PASS: Response is a real summary of your workspace ("You have 3 spaces..."). No discovery question forced at the end.
- FAIL #1: AI ignores your question and asks discovery
- FAIL #2: "What I've gathered" panel disappears after this message
- FAIL #3: Generate Structure button highlight changes state

### Scenario C - Discovery opt-out

Type: `I don't want to change my structure, I just need to add some documents`

- Expected log: `intent=info`, `routedTo=info`
- PASS: Response acknowledges the user wants to add docs, suggests next step without asking discovery questions
- FAIL: AI asks "tell me how your work is split" anyway

### Scenario D - Continuing discovery after info detour

After Scenario C, type: `ok now help me design my workspace`

- Expected log: `intent=discovery`, `routedTo=clarifier`
- PASS: AI asks the next unfilled discovery question (NOT the same question as Scenario A)
- FAIL: AI re-asks the original discovery question - would mean draft state was lost during B/C

### Scenario E - Health check

Type: `Is my current ClickUp structure good? What would you keep, what would you change?`

- Expected log: `intent=info`, `routedTo=info`
- Note: there is no separate `health_check` intent. Health-check questions correctly classify as `info` since the Info Handler has the workspace analysis context to answer them.
- PASS: Response references SPECIFIC things in your workspace (your space names, your list count) and gives recommendations
- FAIL: Generic answer that doesn't reference your actual structure

### Scenario F - Refinement after Generate Structure

1. Continue discovery to completion (let it ask 3-5 questions, answer each)
2. Click Generate Structure when prompted
3. Wait for plan to be generated
4. Click back to chat (or stay on chat after generate)
5. Type: `rename the Sales space to Growth`

- Expected log: `intent=refine`, `routedTo=reviser`
- PASS: Response says "I renamed Sales to Growth" and StructurePreview shows Growth
- FAIL: Asks discovery questions, or re-generates from scratch

### Scenario G - Info question after refinement

After Scenario F, type: `what does my draft look like now?`

- Expected log: `intent=info`, `routedTo=info`
- PASS: Describes the draft accurately, INCLUDING the Growth rename. Reload the page after this message and confirm the draft still has Growth.
- FAIL #1: Describes the wrong structure
- FAIL #2: After this turn, the draft has lost the Growth rename (the Info Handler must be read-only on the draft)

### Scenario H - Image attachment context

Type: `here's my current process` and attach a PNG/screenshot of any chart

- Expected log: classifier should NOT route to info when image is present (per design rule in `intent-classifier.ts`). Expect `intent=discovery` or `intent=refine`, and `routedTo=clarifier` or `routedTo=reviser`.
- PASS: AI describes what it sees in the image and uses it for discovery/refinement
- FAIL: AI ignores image, or `routedTo=info`

### Scenario I - Profile recall

Type: `what's my industry?`

- Expected log: `intent=info`, `routedTo=info`
- PASS: Says "Marketing Agency" (from profile data threaded into the Info Handler)
- FAIL: Says "I don't know" or asks - means profile context not threaded

### Scenario J - History recall across info turns

After 5+ messages of mixed discovery and info, type: `what have I told you so far about my business?`

- Expected log: `intent=info`, `routedTo=info`
- PASS: Mentions specifics from earlier turns (your client count, services, anything you said)
- FAIL: Generic answer or "this is the start of our conversation"

### Scenario K - Rollback drill

1. Set `SETUP_INTENT_CLASSIFIER=disabled` (or `shadow`) in Vercel
2. Redeploy
3. Send a message in the setup chat

- PASS in `disabled`: NO `[setup-intent]` log lines appear at all. Behavior reverts to pre-PR-422 production.
- PASS in `shadow`: `[setup-intent]` lines exist but `routedTo` always equals `legacyWouldHavePicked` (no rerouting). Behavior reverts to pre-PR-422 production.
- FAIL = serious. The flag isn't doing its job. Halt rollout, debug.

After verifying the rollback works, set the env back to `info_only` and
redeploy to resume Phase 2.

## Pass gate (Phase 2 -> Phase 3)

- [ ] All 11 scenarios A-K pass on at least 2 fresh test accounts
- [ ] No regression reports from real users
- [ ] Logs show no 5xx errors from `routedTo=info` turns
- [ ] Spot-check 30 random `intent=info` production turns - all reasonable
- [ ] At least one real user reports the chat "feels smarter" or stops complaining about re-asking

## On failure

If any scenario fails: rollback to `shadow` mode, fix the underlying issue
(could be classifier prompt tuning, Info Handler prompt tuning, or routing
logic), redeploy, restart the scenario suite from the top.

## Rollback

In Vercel -> Settings -> Environment Variables, set
`SETUP_INTENT_CLASSIFIER=shadow` (or `disabled`) and redeploy. Effect on
users: behavior reverts immediately to legacy routing.

## Promote to Phase 3

When the pass gate is fully checked, change `SETUP_INTENT_CLASSIFIER` from
`info_only` to `enabled` in Vercel and redeploy. That activates full
classifier-driven routing for all three intents (`discovery` -> Clarifier,
`refine` -> Reviser, `info` -> Info Handler). At that point the legacy
isReadyDraft routing only fires when classifier confidence is below 0.6 or
fallbackUsed is true.
