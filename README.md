# Course Card

An offline-first golf reference card for the iPhone home screen.
Dark green/gold theme, 7 tabs: Plan, Yards, Lies, Chips, Slopes, Grain, Sand.

## Files

| File | What it is |
|---|---|
| `index.html` | **The card.** All content, styling and diagrams. This is the only file you normally edit. |
| `manifest.webmanifest` | App name, icon and colours for the home screen. |
| `sw.js` | Service worker — makes it work with no signal. |
| `icons/` | Home-screen icons (180 / 192 / 512 px). |

## Editing the card

Edit `index.html`, then:

```bash
git add -A && git commit -m "Update yardages" && git push
```

GitHub Pages redeploys in ~30 seconds.

**How updates reach your phone:** the service worker serves the cached copy
instantly, then quietly re-downloads in the background. So after a push, open
the app once with signal (it still shows the old card), then open it again —
the second open shows your edit. This is deliberate: it means the card *never*
waits on the network when you're on the course.

Want it immediately? Open the app twice, or hold the app icon → delete → re-add.

You only need to touch `sw.js` if you **add or rename a file** — add it to the
`ASSETS` list and bump `course-card-v1` to `-v2`.

## Testing locally

```bash
python -m http.server 8123 --directory course-card
```

Then open `http://localhost:8123`. Service workers only run on `localhost` or
HTTPS, so opening `index.html` as a `file://` path won't exercise the offline
behaviour (the card itself will still render fine).

## Adding to the iPhone home screen

Open the Pages URL in **Safari** (not Chrome — only Safari can install to the
home screen on iOS), tap Share → **Add to Home Screen**. Launch it once while
you have signal so everything caches, then it opens instantly and works fully
offline, with no browser chrome and no login.
