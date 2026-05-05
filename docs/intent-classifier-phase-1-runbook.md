# Phase 1 - Intent Classifier Shadow Mode

Operational guide for running the setup-chat intent classifier in shadow mode
on production. Code shipped in PR #422; this doc covers activation,
observation, and the gate to Phase 2.

## What shadow mode does

The classifier (Haiku) runs on every setup chat turn and emits one log line per
turn. Routing is unchanged - users see exactly the same behavior they had
before. Data only.

## Activate

1. Vercel -> Settings -> Environment Variables
2. Edit `SETUP_INTENT_CLASSIFIER`
3. Toggle the "Sensitive" switch off (so the saved value is verifiable)
4. Set Value to exactly: `shadow`
5. Save
6. Vercel -> Deployments -> latest -> ... -> Redeploy
7. Wait for redeploy to finish

Valid values: `disabled`, `shadow`, `info_only`, `enabled`. Anything else
falls back to `disabled`.

## Verify it's running

Send one message in production setup chat, then in Vercel -> Logs filter on
`[setup-intent]`. You should see one line per chat turn shaped like:

```
[setup-intent] {"mode":"shadow","conversationId":"...","intent":"discovery",
"confidence":0.92,"reasoning":"...","fallbackUsed":false,"modelCallMs":287,
"legacyWouldHavePicked":"clarifier","messagePreview":"I run a marketing..."}
```

If you see zero lines after sending traffic, the env var didn't apply.
Re-check the value (not blank, exactly `shadow`) and redeploy again.

## Collect logs

In Vercel -> Logs, filter on `[setup-intent]` and export to a text file. Copy
or download is fine - the analysis script tolerates Vercel's text and NDJSON
formats and ignores anything that isn't a `[setup-intent]` line.

## Run the analysis

```
node scripts/analyze-intent-logs.mjs path/to/logs.txt
```

The script prints:
- Per-intent counts and percentages
- Actual routing (what user saw, since shadow doesn't reroute)
- Classifier vs legacy disagreement breakdown
- Confidence buckets and fallback rate
- Latency p50 / p95 / p99 / max
- A 20-row spot-check sample with `messagePreview`

## Spot-check

Open `docs/intent-classifier-phase-1-spotcheck.md`, paste the 20 rows from the
script output, and judge each one.

For every row:
- "Your call" = what intent should this message be? (discovery / refine / info)
- "Match?" = does the classifier pick equal your call? (yes / no)
- Mark any violations:
  - **info-on-discovery**: classifier said `info` on a clearly-discovery message
  - **discovery-on-opt-out**: classifier said `discovery` on a clearly opt-out message

## Pass gate (Phase 1 -> Phase 2)

Promote to `info_only` only if all of these are true:

- [ ] At least 50 setup chat turns logged
- [ ] Zero 5xx errors on `/api/setup/chat` over the window
- [ ] Latency p50 <= 400ms
- [ ] Latency p99 <= 1500ms
- [ ] Fallback rate <= 5%
- [ ] Spot-check >= 18/20 match (90%)
- [ ] Zero info-on-discovery violations
- [ ] Zero discovery-on-opt-out violations

The first five are checked automatically by the script. The last three are
manual.

## On failure

If any check fails, tune the classifier prompt in
`src/lib/setup/intent-classifier.ts` (the `STATIC_PROMPT` constant) using the
misclassified messages from the spot-check as negative examples. Redeploy.
Re-collect logs. Re-run the analysis. Re-spot-check. Repeat until the gate
passes.

## Rollback

In Vercel -> Settings -> Environment Variables, set
`SETUP_INTENT_CLASSIFIER=disabled` (or delete the variable) and redeploy.
Effect on users: nothing changes. Effect on logs: classifier stops firing.

Reversible at any moment. Phase 1 carries no user-facing risk.

## Promote to Phase 2

When the pass gate is fully checked, change `SETUP_INTENT_CLASSIFIER` from
`shadow` to `info_only` in Vercel and redeploy. That activates the new Info
Handler for classifier-routed `info` turns. `discovery` and `refine` still
use legacy routing.
