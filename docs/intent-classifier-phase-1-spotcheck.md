# Phase 1 - Intent Classifier Spot-Check

Fill this in after running:

```
node scripts/analyze-intent-logs.mjs path/to/logs.txt
```

Paste the 20 sample rows from the script output below, then add the "Your call"
and "Match?" columns by hand.

PASS = at least 18/20 match AND zero info-on-discovery AND zero discovery-on-opt-out.

## Sample

| # | Message preview | Classifier | Legacy | Conf | Reasoning | Your call | Match? |
|---|-----------------|------------|--------|------|-----------|-----------|--------|
| 1 |                 |            |        |      |           |           |        |
| 2 |                 |            |        |      |           |           |        |
| 3 |                 |            |        |      |           |           |        |
| 4 |                 |            |        |      |           |           |        |
| 5 |                 |            |        |      |           |           |        |
| 6 |                 |            |        |      |           |           |        |
| 7 |                 |            |        |      |           |           |        |
| 8 |                 |            |        |      |           |           |        |
| 9 |                 |            |        |      |           |           |        |
| 10 |                |            |        |      |           |           |        |
| 11 |                |            |        |      |           |           |        |
| 12 |                |            |        |      |           |           |        |
| 13 |                |            |        |      |           |           |        |
| 14 |                |            |        |      |           |           |        |
| 15 |                |            |        |      |           |           |        |
| 16 |                |            |        |      |           |           |        |
| 17 |                |            |        |      |           |           |        |
| 18 |                |            |        |      |           |           |        |
| 19 |                |            |        |      |           |           |        |
| 20 |                |            |        |      |           |           |        |

## Decision rules for "Your call"

- **discovery** = user is describing how they work, what their team is, what their process looks like
- **refine** = user is asking for a specific change to a generated plan (rename, add, remove). Only valid when there is a ready draft.
- **info** = user is asking a question, asking for analysis, asking what they have, opting out of structural changes

## Result

- Match count: __ / 20
- info-on-discovery violations: __
- discovery-on-opt-out violations: __
- **Promote to Phase 2: yes / no**

## Misclassified messages

If any row failed, copy it here so the classifier prompt can be tuned with it
as a negative test:

1.
2.
3.
