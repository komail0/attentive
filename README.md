# Attentive

Anonymous live lecture feedback. A student who lost the thread pins the slide with one tap; the lecturer sees where the room is lost, as tally marks on the slide, and never who pinned.

Team C04 (attentive), CS3014 Applied HCI, FAST NUCES Islamabad.

## What it does

**Students** (phone, no account, no cookie)
- Join with a short code such as `KMR-4821`.
- See a one-line summary of every slide so far, pin the one where they got lost, undo, and add an optional comment.
- See their own pins on their own device only.
- After class, read the summaries and transcript with their pinned slides first.
- English and Urdu (right to left), three text sizes, light and dark theme, installable as an app.

**Lecturers** (laptop or tablet)
- Register, sign in, and keep their sessions.
- Create a session, upload a PDF (each page becomes a slide, title read from the page), check the titles, share the code, start.
- Live dashboard: a strip of slides with tally marks, anonymous comments, a transcript they can add to, and a button to show a different slide to students.
- End the lecture and read the report (print or save as PDF).

**Anonymity is built into the data.** A pin is a row with only a session and a slide number: no student id, no time, no device. Counts under 3 are shown to the lecturer as "a few". See [docs/PRIVACY.md](docs/PRIVACY.md).

## Stack

| Part | Choice |
|---|---|
| Client | React 19, TypeScript, Vite, React Router, Lucide icons, self-hosted fonts (Anton, DM Sans, Baloo Bhaijaan 2) |
| Server | Node 22, Express, TypeScript |
| Database | SQLite (better-sqlite3), migrations run on start |
| Live updates | Server-sent events |
| Tests | Vitest and supertest (server), Playwright and axe-core (browser) |

## Run it

Needs Node 22 or newer.

```bash
npm install
cp .env.example .env        # set SESSION_SECRET to a long random string for anything beyond a demo
npm run build               # builds the client
npm start                   # serves the app and the API on http://localhost:3000
```

For development with reload: `npm run dev` (client on 5173, proxied to the server on 3000).

**On a phone:** put the phone on the same Wi-Fi as the computer and open `http://<computer address>:3000`.

## Test it

```bash
npm test            # server tests (accounts, sessions, anonymity, threshold, PDF upload)
npm run test:e2e    # builds, then drives the real app in Chrome: flows, axe on every screen in both themes and both languages, keyboard, reflow, target size
```

## Layout

```
client/      React app (student and lecturer screens, i18n, PWA)
server/      Express API, SQLite schema and migrations
design/      The finished light and dark mock-ups and the logo
docs/        Architecture and privacy notes
```

Deployment is out of scope for now.

## Notes for reviewers

- Urdu text for the new screens is an AI draft and needs a human reading. Lecturer screens other than the dashboard fall back to English where no Urdu string exists.
- Slide summaries default to the first sentence of each slide. Set `ANTHROPIC_API_KEY` to generate one-line summaries instead (slide text is then sent to that service).
- The transcript is typed in by the lecturer. No audio is ever captured. A speech-to-text provider can be added behind the same endpoint.
- Not tested with real screen readers (NVDA, TalkBack) or with real students yet. Automated checks do not replace that.
