<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/conjunto-noite.svg">
  <source media="(prefers-color-scheme: light)" srcset="brand/conjunto-dia.svg">
  <img alt="Flicki" src="brand/conjunto-dia.svg" height="72">
</picture>

<br><br>

**A personal TV diary that helps you decide what to watch tonight.**

Offline-first · installable PWA · built for one hand, at night, with the TV already on.

<br>

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-sync-3FCF8E?logo=supabase&logoColor=white)
![Playwright](https://img.shields.io/badge/tested_with-Playwright-2EAD33?logo=playwright&logoColor=white)
[![CI](https://github.com/e271aa/flicki/actions/workflows/ci.yml/badge.svg)](https://github.com/e271aa/flicki/actions/workflows/ci.yml)

</div>

---

## What is Flicki?

Flicki is a personal diary of everything you watch: series and films, with the
original watch dates. It started life as *Episodic*, written after TV Time shut
down in July 2026 and took its users' data with it. The entire viewing history
was recovered from a GDPR export and imported, dates included.

It is **not** a social network and **not** a catalogue. Its job is to do three
things, in this order:

1. **Decide what to watch tonight.** Open the app and know immediately what
   comes next.
2. **Never lose your place.** The next episode of every show, with no gaps and
   no confusion between "not watched yet" and "watched but never ticked off".
3. **Keep the whole history.** A diary of everything you have ever watched,
   with original dates and statistics.

Discovery exists and is useful, but it is deliberately not the main job.

> **Flicki proposes, it never decides for you.** The numbers have to be right:
> the app never claims you still have to watch something you have already
> seen, or the reverse.

## Features

| | |
|---|---|
| **Up next / Tonight** | The next episode of each show in progress, front and centre. |
| **Catch up** | A swipeable deck for episodes you watched but never marked. |
| **Explore** | Discover new shows and films, with swipe-to-triage. |
| **Library** | Series and films, with filters and sort orders. A series is either in progress or *not started*. |
| **Detail pages** | Seasons, episodes, gaps, and where to stream in Portugal (JustWatch data via TMDB). |
| **Lists** | Your own collections. |
| **Upcoming** | What is about to air. |
| **Statistics** | Viewing time, history by date, tastes. |
| **Import from TV Time** | Reads the GDPR export and rebuilds the library, original dates included. |
| **Review & verify library** | Finds and fixes inconsistencies in the data. |
| **Light and dark** | Follows the iPhone by default, or pin one under Profile › Appearance. |

### Designed for

- **A phone, one hand, at night.** Installed to the home screen as a PWA and
  tuned for an iPhone 15 Pro Max (430 × 932). The test suite also checks 390 px
  and 320 px widths.
- **No signal.** Data lives on the device (IndexedDB) and works offline.
  Anything written locally syncs to the cloud on its own.
- **Reinstalling without losing anything.** Signing in again restores the whole
  library from Supabase.
- **Portuguese (Portugal).** The interface is in pt-PT throughout.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) and React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Local data | IndexedDB through [`idb`](https://github.com/jakearchibald/idb), offline-first |
| Cloud sync & auth | [Supabase](https://supabase.com) with Row Level Security |
| Metadata | [TMDB](https://www.themoviedb.org) (in pt-PT) and [TVmaze](https://www.tvmaze.com) |
| Import | [`papaparse`](https://www.papaparse.com) and [`jszip`](https://stuk.github.io/jszip/) for the TV Time export |
| Icons | [`lucide-react`](https://lucide.dev) |
| Tests | [Playwright](https://playwright.dev) (WebKit, mobile viewports) |
| Hosting | [Vercel](https://vercel.com) |

Show metadata comes from two sources. Each series records which of the two is
authoritative for its season numbering. That keeps season and episode counts consistent.

## Project structure

```
.
├── web/                  The app (Next.js)
│   ├── src/app/          Routes: home, library, series, movies, explore, stats…
│   ├── src/lib/          Data layer: IndexedDB, sync, TMDB/TVmaze, stats, import
│   ├── supabase/         Database schema and maintenance SQL
│   ├── scripts/          Icon generation and import tooling
│   └── tests/            Playwright test suite
├── brand/                Logos, wordmarks and brand guidelines
└── .github/workflows/    CI: type-check, lint and tests on every push
```

## Getting started

### Prerequisites

- Node.js 22 or newer
- A free [Supabase](https://supabase.com) project (for accounts and sync)
- Optionally, a free [TMDB API key](https://www.themoviedb.org/settings/api).
  Without it the app falls back to TVmaze, which needs no key.

### Setup

```bash
git clone https://github.com/e271aa/flicki.git
cd flicki/web
npm install
```

Create `web/.env.local`:

```bash
# Optional. Without it, the app uses TVmaze.
TMDB_API_KEY=your_tmdb_v3_key

# Supabase → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
```

The Supabase anon key is public by design. Security comes from Row Level
Security on the server, so apply the schema before using the app:

```bash
# Run the contents of web/supabase/schema.sql in the Supabase SQL editor
```

Then start the dev server:

```bash
npm run dev
```

Open <http://localhost:3000>. To use it like the real thing, open it on a
phone and add it to the home screen.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Playwright suite |
| `npm run test:ver` | Playwright in interactive UI mode |
| `npx tsc --noEmit` | Type-check |

Before running the tests for the first time, install the browser they use:

```bash
npx playwright install webkit
```

## Importing from TV Time

TV Time users can request a GDPR data export. Flicki reads it in the app
(**Import from TV Time**) and rebuilds the library: shows, episodes, films and
their **original watch dates**.

The export contains personal data such as your email address and a password
hash, so keep it out of version control. This repository already ignores
`private-data/` for that purpose.

## Testing

The Playwright suite runs against mobile viewports and covers the things that
matter most in a tracker: episode and season counting, gaps, statistics and
dates, navigation and state that survives pressing Back, contrast and
accessibility, offline behaviour, and text fitting at small widths. CI runs
type-checking, lint and the full suite on every push and pull request.

## Brand

The mark is the **pressed bar**: seven colour bars, like a test card, with the
fourth (green) bar pushed down by a tenth of its height.

<div align="center">

<img src="brand/simbolo.svg" alt="Flicki symbol" width="96">

</div>

| Colour | Hex |
|---|---|
| Light grey | `#e5e5ea` |
| Yellow | `#ffd60a` |
| Cyan | `#64d2ff` |
| Green | `#30d158` |
| Magenta | `#da5ce8` |
| Red | `#ff453a` |
| Blue | `#0a84ff` |

Logo files, colour rules, clear space and minimum sizes are in
[`brand/`](brand/LEIA-ME.md). That guide is written in Portuguese.

## Status

Flicki is a personal project, built first for one person and then for a few
friends by invitation. Open sign-up is not a goal, so there is no public
instance to join.

## Credits

Metadata and images are provided by [TMDB](https://www.themoviedb.org) and
[TVmaze](https://www.tvmaze.com). Streaming availability comes from JustWatch
through TMDB.

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

No license has been granted. The source is published for reference, and all
rights are reserved unless stated otherwise.
