# Stitch Counter

A simple row counter for knitting and crochet projects, made for an iPhone.

- Projects with size, needle or hook sizes, craft and yarn color
- Parts (Ribbing, Body, Sleeves…) in the order you make them, each with a target row count
- Row patterns: odd/even labels or a row-by-row repeat, plus notes per part
- Knitting mode: one big **Complete Row** button, multi-step undo, haptic tap and optional sound, screen stays on
- Pauses at the end of each part and asks before moving on
- Crochet projects count **rounds**
- Dark mode, works offline, installs to the home screen
- Everything is saved on the phone (localStorage); Settings has backup and restore

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it from the home screen icon from then on. The home screen app keeps its own saved projects, separate from the Safari tab.

## Development

No build step. Serve the folder with any static server, e.g. `python3 -m http.server`, and open it.
After changing files, bump `CACHE` in `sw.js` so installed copies pick up the update.
