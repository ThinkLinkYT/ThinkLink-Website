# ThinkLink Wrapped Apps Script

This optional script stores short-lived Wrapped payloads in a Google Sheet so Discord can open short unique URLs like:

`wrapped.html?id=abc123&api=https://script.google.com/.../exec`

## Setup

1. Create a new Google Apps Script project.
2. Paste `wrapped-api.gs` into `Code.gs`.
3. Open **Project Settings** and add a script property:
   - `WRAPPED_API_KEY`: any long random secret you choose.
4. Deploy as a **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the web app URL into the bot host as `WRAPPED_API_URL`.
6. Put the same secret in the bot host as `WRAPPED_API_KEY`.

The script creates a Google Sheet automatically the first time the bot saves a Wrapped payload.
