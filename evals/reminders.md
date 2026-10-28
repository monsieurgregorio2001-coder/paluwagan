# Reminder rubric

Proposed by Claude, waiting for Garfield's review. This file is the label set for `npm run eval:reminders`.

The eval builds every reminder draft the app can produce, then scores each one on four rules. A draft passes only when it meets all four.

1. **Amount.** Every peso amount in the text equals the amount the member still owes for that cycle, computed from the ledger (`cycleOutstanding`). At least one amount is present.
2. **Language.** The draft's language tag (`en` or `fil`, which becomes the `lang` attribute) matches the language of the text, judged by counting common English and Filipino words.
3. **No extra facts.** After the member's name, the group name, the amount, the due date, and "cycle N" are removed, no digits, peso signs, number words or durations remain. A draft cannot promise a deadline or claim a history the record does not hold.
4. **Name and cycle.** The draft names the member on the record, states the cycle the member owes for, and gives that cycle's due date.

## What is scored

- Both seeded demo groups at a fixed date.
- 300 randomized groups (3 to 8 members, weekly, every two weeks, or monthly) in random mid-round states: on time, late, missed, short, partly settled, and reversed entries.
- Every language (English, Filipino) and every tone (polite, firm, final) for each member who needs a reminder.

## Negative controls

Four broken drafts, one per rule, must fail the rule they break. If any passes, the eval fails.

## Limits

- Tone is not scored.
- A person's edits to a draft are not scored. The rubric covers the text the app writes.
- Language is judged by word counts, not by a language model. It can be wrong on a text that mixes both languages.
- Templates are pre-written. No model writes a reminder at runtime.
