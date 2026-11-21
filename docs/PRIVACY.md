# Privacy

Attentive promises one thing to students: **the lecturer cannot tell who pinned a slide.** This is how the code keeps that promise.

## What is stored

| Table | Columns | Notes |
|---|---|---|
| `pins` | `id`, `session_id`, `slide_n` | No student id, no time, no device, no address. |
| `comments` | `id`, `session_id`, `slide_n`, `text` | The text the student typed. No time, no author. |
| `sessions` | includes `joined` | Joining only adds one to this counter. |
| `transcript_lines` | `session_id`, `at`, `text` | Typed by the lecturer. `at` is the lecturer's clock time. |
| `lecturers` | name, email, password hash | The only people with accounts. |

Students have **no account and no cookie**. The server never sets an identifier for them.

## How the threshold works

The server decides what the lecturer may see. For each slide it sends `"none"`, `"few"` (1 or 2 pins) or the number (3 or more). The exact count below 3 never leaves the server, and the same rule applies to the total and to the report.

## What the server sees but does not keep

A request from a student phone carries a network address and a device name, as every web request does. They are not written to the database or to any log by the application. The rate limiter keeps counters in memory only, keyed by address, and they disappear on restart. If you deploy behind a proxy or host that keeps access logs, those logs are outside the application: configure them to match this promise.

## Where a student's own pins live

In the browser's local storage on their own device. The server cannot return them. Clearing site data clears them.

## Known limits (stated, not hidden)

- **Small rooms.** With very few students even "3 or more" narrows things down. The threshold is a constant (`server/src/config.ts`) and can be raised.
- **Comments are free text.** A student could sign a comment. The help screen tells them not to write anything that identifies them. There is no moderation yet.
- **Unpin cannot verify ownership.** Because the server does not know who pinned, unpin removes one pin from that slide. A device that scripts requests could remove other students' pins. Rate limiting reduces this; it does not remove it.
- **Optional AI summaries** send slide text to an external service when `ANTHROPIC_API_KEY` is set. Student data is never sent.

## Tests that guard this

`server/test/api.test.ts` checks the exact column lists of `pins` and `comments`, that a device name and address sent by a student appear in no table, that the exact count under 3 never appears in the lecturer response, and that the after-class page carries no pin data. The browser test checks that students get no cookie.
