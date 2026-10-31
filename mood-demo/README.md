# Embedded HiHi Mood Journal

This is the original frontend build from the user's HiHi Mood Journal, source
revision `6504568`, matching the published `index-CyVIzbjF.js` bundle. The app's
screens, interactions, device runtime, and browser-local journal storage are
preserved. Only static asset URLs are relocated for GitHub Pages. The surrounding
preview background is transparent so it fits the portfolio's project backdrop.

Identical existing image, device and font assets are reused from `hihi-demo/`.
Any different source image is copied unchanged. The app's source project and
its independent Sites deployment are not modified.

To refresh the packaged frontend from an existing build:

```sh
node scripts/sync_mood_demo.mjs /absolute/path/to/dist/client
```

If the build's bundle filenames change, update this directory's `index.html`.
