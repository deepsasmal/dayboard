# Dayboard (web edition)

A calm place to plan work and the day: Kanban tasks, live notes, daylight, paintings, a calendar and time rings. Vanilla HTML/CSS/JS, **no build step, no dependencies**. Installable as a PWA. Live at https://deepsasmal.github.io/dayboard/

Your data stays in **your own browser** (`localStorage`, plus IndexedDB for your own wallpapers). Nothing is sent to any server of mine; the app only fetches public data (art, weather, quotes).

This repo is the web edition of a Chrome extension (a new-tab page). Files here are produced from that extension's source, so if you are an assistant continuing this work: you may edit these files directly, but keep changes small and self-contained.

## Files

| File | Role |
|---|---|
| `index.html` | All markup: one page with many overlays (notes, calendar, time view, Spotlight, focus mode...) |
| `newtab.css` | All styles, token-based dark glass theme (amber accent, hairline borders) |
| `newtab.js` | All logic in one plain script (~2500 lines) |
| `shim.js` | Stubs `chrome.alarms` (no extension APIs here) and registers `sw.js` |
| `sw.js` | Network-first cache so the app opens offline |
| `manifest.webmanifest`, `icons/` | PWA install metadata |

## How it works

- **Storage.** `store.get/set` in `newtab.js` uses `chrome.storage.local` when it exists (extension) and otherwise one JSON blob at `localStorage.dayboard`. In this edition it is always the blob. Persisted keys: `tasks, projects, notes, saved, links, active, sview, dockSeeded, prefs, paint, trash, snaps, meeting, hook`. Per-browser caches live in `localStorage` under `dayboard:*` (art rotation, quote of the day, weather, festival data, weekly painting catalogue, UI flags).
- **Rendering.** State arrays (`tasks`, `links`, `saved`...) are mutated then `save()` + `render()` redraw. There is no framework.
- **Tasks.** Quick add parses `#tag !1..3 @waiting-on`. Columns To do / Doing / Waiting / Done; Any time / Today / Next 7 days; projects; drag to reorder.
- **Shortcuts.** `SEED` in `newtab.js` seeds the top bar (no project) and the **Quick navigation** strip under the board (`@dock`). All editable in the UI.
- **Spotlight** (`Ctrl+K`, `/`, or click the top search bar): commands, shortcuts, projects, notes, tasks; any other text becomes "Add task". Prefixes `gpt `/`?` (ChatGPT), `g ` (Google), `claude `.
- **Backgrounds.** Met Open Access paintings and Wikimedia nature photos, rotated every 3 hours with weighted, slot-stable picks (`weightOf`, `drawFrom`, `pickIdx`); a weekly-refreshed Met catalogue (`libFetch`); your own pictures in IndexedDB; weather effects (Open-Meteo) drawn on the background only; a wallpaper picker; "Look closer" detail tour; painting story panel (Met -> Wikidata -> Wikipedia).
- **Weather.** The date line has a small temperature chip that opens a card (conditions, feels-like, rain, wind, next hours and days); the calendar week view shows daily highs. Open-Meteo, no key. Units follow your region (Spotlight: "Temperature: switch").
- **Moon.** Phase, moonrise/moonset and the next new/full moon are computed on the device; after sunset the moon rides the sun arc, and a small moon icon (or Spotlight "Moon phase") opens a card with the details.
- **Time.** Sunrise/sunset arc computed locally from a chosen city (`CITIES`, `prefs.city`), time rings with hover highlighting, a Time view (life in weeks needs a birth date; year in dots), and a calendar with famous Indian festivals (`FEST`, bundled `FEST_FALLBACK` for 2026-27).
- **Calm features.** Focus mode (`F`, frosted lettering only), calm mode (`Z`), Open the day ritual (`O`), one-minute breath (`B`), Sort my head (`T`), Wrap up the day (`E`).

### Keyboard

`A` new task, `N` notes, `S` toggle notes, `M` meeting view, `F` focus, `Z` calm, `T` sort, `E` wrap up, `O` open the day, `B` breath, `L` look closer, `W` time view, `C` calendar, `Ctrl+K` or `/` Spotlight. Single-letter shortcuts are ignored while typing: use `typingNow()` (covers contenteditable) in any new global key handler.

## Notes architecture

Notes are **stored as markdown** (`saved[i] = {id,title,body,proj,ts}`), shown in a live **contenteditable** editor `#ned` where each markdown line is a `<div data-t="p|h1|h2|h3|li|ol|todo|quote|code" data-i="indent" data-d="done">`.

- `mdToLines()` markdown -> lines, `getDoc()` lines -> markdown, `inlineMd()` inline marks, `renumber()` ordered lists.
- A hidden `<textarea id="notes">` is the data interface. Its `value` setter is overridden to re-render the editor; `sync()` writes the editor back and calls `ta.oninput()`. `ta.focus/blur` are redirected to the editor, so older code using `$("#notes").value` keeps working.
- Autosave only: the first words in a blank page create a note; blank notes are dropped when you leave them; the latest note opens on load; the list shows title, time and first line, with search.
- Shortcuts while typing: `# `, `- `, `1. `, `[] `, `> `, ```` ``` ````+Enter; Enter/Backspace/Tab list behaviour; click a round checkbox to tick; Ctrl+B/I; Ctrl+K link; multi-line paste is parsed as markdown.

## Data sources and limits

- **Met Collection API.** Object lookups use `v1/objects/<id>`; **search is `v1.1` only**. It returns 403/429 after request bursts, so `libFetch` uses batches of 3 with pauses and a call cap, and backs off ~40 minutes on a 403.
- **Wikimedia** thumbnails: use width 330 (320 returns 400). **Open-Meteo**, **Wikidata** (`origin=*`) and **Wikipedia REST** allow CORS.
- **ZenQuotes** and **Google's public iCal** (festivals) do **not** allow CORS from web pages, so here the quote falls back to a local list and the calendar uses bundled 2026-27 data. They work in the extension version through host permissions.
- Not available on the web: Outlook meetings (calendar feeds are not CORS-readable from a web page; the extension edition has them), task reminders and golden-hour notifications (need extension alarms), the background daily Discord backup (use Export/Import, the data format is plain JSON), site favicons (letter tiles are shown instead).

## Gotchas

- Do not put `will-change:transform` on the background image: it blurs under scale.
- Grid containers with `place-items` shrink absolutely positioned children: give explicit `width/height`.
- `e.target.closest` fails if the clicked element was detached by a re-render mid-click: use `e.composedPath()`.
- A slow older image can overwrite a newer one: `showSeq` guards `show()`.
- Pinned wallpaper is a tuple array in `dayboard:pin`: use `pin?.[0]`.
- Notes must stay recoverable: the list shows every note by default (project filter is opt-in), deletes go to a 30-day trash, daily snapshots exist.

## Run and test locally

```sh
python3 -m http.server 8080   # in this folder, then open http://localhost:8080/
```

No test runner. Checks were done with Playwright (headless Chromium, fresh browser context, `page.clock.install` for fixed dates, wait for the global `artNow` before asserting). Tested in headless Chromium at desktop, tablet (1024-1280) and phone (390) widths; not on real Android hardware.

## Deploy

Static files on GitHub Pages (`main`, root). Commit and push; it redeploys in about a minute. `sw.js` is network-first, so installed copies pick up changes on the next online load.

## Conventions

Calm and minimal: no permanent clutter, new features hide behind a key, Spotlight or the corner menu. Nothing personal in this repo: shortcuts here are generic and no user data is ever committed.
