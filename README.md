# ThinkLink Website

Static GitHub Pages site for the ThinkLink Minecraft YouTube channel.

## Auto-update plan

Yes: this can auto-update without running a backend server. The safe setup is:

- GitHub Pages hosts the static website.
- GitHub Actions runs hourly and writes fresh YouTube data into `data/channel.json`.
- The browser only reads that public JSON file, so no private key is shipped to visitors.

The updater works best when the repository has a `YOUTUBE_API_KEY` secret. Without that secret, it still checks YouTube's public RSS feed for the latest upload, but subscriber count and full channel statistics may stay blank.

Channel member counts are different. YouTube does not expose a public live member count for a static website. Reading paid membership data requires creator-owned authorization and should not be done in browser code. This site keeps that area as a professional "Soon" state until memberships are unlocked and there is a secure plan for it.

## Deploy

1. Push this folder to GitHub.
2. In the repository, open Settings -> Pages.
3. Set the source to GitHub Actions.
4. Run the `Deploy GitHub Pages` workflow, or push to `main` or `master`.

## Better YouTube syncing

Create a YouTube Data API v3 key in Google Cloud and save it as a repository secret named `YOUTUBE_API_KEY`.

Keep the key private and restrict it to the YouTube Data API where possible. Since the key is used only inside GitHub Actions, it should never appear in `index.html`, `assets/js/app.js`, or `data/channel.json`.

## Local preview

Run a small static server from this folder:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.
