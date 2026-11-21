# Architecture

```
 phone (student)  ──HTTP──►  Express ──► SQLite
 laptop (lecturer) ─HTTP + SSE─►  │
                                   └─► serves the built React client
```

One Node process serves the API and the static client. State lives in one SQLite file.

## Server (`server/src`)

| File | Job |
|---|---|
| `app.ts` | Builds the Express app: security headers (CSP, no framing), JSON limits, routes, SPA fallback, error handler that never leaks details. |
| `lib/db.ts` | Opens SQLite, runs numbered migrations inside transactions (`PRAGMA user_version`). |
| `lib/auth.ts` | scrypt password hashes, HMAC-signed cookie, `requireLecturer`. |
| `lib/live.ts` | The one place counts are turned into what the lecturer may see (`display`), and the SSE hub. |
| `lib/slides.ts` | Session codes, PDF text extraction (largest text on a page is the title), first-sentence summaries, optional AI summary. |
| `routes/auth.ts` | Register, sign in, sign out, who am I. Rate limited. |
| `routes/sessions.ts` | Lecturer API: sessions, slides (edit or PDF upload), start, end, current slide, transcript, live stream, report. Every route checks the session belongs to the signed-in lecturer. |
| `routes/student.ts` | Anonymous API: join, state, pin, unpin, comment, after-class. |

### Session lifecycle

`draft` (slides being prepared) → `live` (students can pin) → `ended` (report and after-class). Students only see slides up to the one the lecturer is on, so "every slide so far" is literal.

### Live updates

The lecturer dashboard opens an `EventSource` to `/api/sessions/:id/stream`. Every pin, unpin, comment, join, slide change or transcript line calls `push`, which sends the full lecturer state. Students poll `/state` every 4 seconds (no student connection is held open).

## Client (`client/src`)

| Path | Job |
|---|---|
| `styles/app.css` | The design system: theme tokens (dark gold, light green), type, buttons, rows, sheet, tally, desk layout. Ported from the finished mock-ups in `design/`. |
| `lib/prefs.tsx` | Language, text size and theme, remembered per device; sets `lang`, `dir` and `data-*` on `<html>`. |
| `lib/student.tsx` | Student state: polling, pin and undo with failure and retry, comments, pins kept in local storage. |
| `lib/auth.tsx` | Lecturer sign-in state. |
| `components/ui.tsx` | Controls, top bar, tabs, sheet with focus trap, field with linked errors, tally marks. |
| `pages/` | Join, student screens, lecturer screens. |
| `i18n/` | English and Urdu strings. Missing Urdu falls back to English. |

### Accessibility choices

- `aria-disabled` instead of `disabled` on the pin buttons, so focus stays where it was.
- Status and error messages are live regions that are always in the page.
- The comment sheet traps focus, closes on Escape and returns focus to the button that opened it.
- Every control is at least 44 px, text can grow to 125 %, and nothing scrolls sideways at 320 px.
- Accent colour always means a pin; warnings use a separate red with a dashed border and an icon, so colour is never the only signal.

## Tests

- `server/test` runs the API in memory.
- `client/e2e` starts the real server and built client on port 3200 and drives Chrome. `a11y.spec.ts` runs axe on every screen in both themes and both languages.
