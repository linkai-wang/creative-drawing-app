# Changelog

Short notes on project updates.

## 2026-10-17 — Story backend

- Added a separate Node.js service for AI stories with server-side model credentials.
- Added task validation, classroom access codes, request limits, timeouts, and safe errors.
- Connected the story interface with retry and navigation cancellation.
- Added a Render deployment template and a short setup guide.
- Added backend, client, and desktop/mobile browser checks with a fake model provider.
- Production hosting, model credentials, and a real-provider check are still required.

## 2026-10-16 — Local interface icons

- Replaced the external icon font with local SVG interface icons.
- Added distinct icons for the drawing tools.
- Added a browser regression check for painted brush icons when external resources are blocked.

## 2026-10-16 — Classroom workflow

- Added a teacher workbench for activity goals, task selection, ordering, and custom steps.
- Added authored step-by-step guidance for all 36 tasks, quiet presentation, and simpler tools.
- Added anonymous activity review and CSV export of explicit drawing actions.
- Added model validation and desktop/mobile Chromium workflow checks.
- Validation: 49 Node tests and 10 desktop/mobile Chromium checks passed. Teacher evaluation is pending.

## 2026-10-16

- Added regression checks for saved drafts and drawing progress.
- Added PNG downloads from the completed artwork preview.
- Added export checks for invalid images, repeated clicks, and switching artwork.
- Kept artwork preview actions reachable on small screens.
- Fixed validation of draft keys and timestamps.
- Fixed autosave when a page is hidden before the current drawing stroke ends.
- Added draft saving on the pagehide event.
- Preserved the original Chinese saving messages.
- Added automatic regression checks on GitHub and testing instructions.
- Validation: 40 automated tests passed locally and in GitHub Actions. Browser and device checks are still pending.
