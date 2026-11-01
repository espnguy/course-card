# Course Card

An offline-first golf reference card for the iPhone home screen.
Dark green/gold theme, 5 tabs: Yards, Lies, Chips, Grain, Sand. Opens on Yards.

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

**How updates reach your phone:** automatically. Whenever the app opens or
comes back to the front, it checks for a newer card. If there is one, it
updates its offline copy and reloads itself, which takes about a second. With
no signal the check does nothing, so the card always opens instantly on the
course.

You only need to touch `sw.js` if you **add or rename a file** — add it to the
`ASSETS` list and bump the version number in `CACHE` (e.g. `-v2` to `-v3`).

## Tests

```bash
node tools/check.js        # layout rules at the Duo's four screen sizes
node tools/update-test.js  # offline + auto-update flow, service worker on
```

`check.js` needs the local server on port 8125 (below); `update-test.js`
runs its own.

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
