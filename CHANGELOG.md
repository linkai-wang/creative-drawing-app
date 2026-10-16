# Changelog

Short notes on project updates.

## Unreleased

### Classroom workflow

- Added a teacher workbench for activity goals, task selection, ordering, and custom steps.
- Added authored step-by-step guidance for all 36 tasks, quiet presentation, and simpler tools.
- Added anonymous activity review and CSV export of explicit drawing actions.
- Added model validation and desktop/mobile Chromium workflow checks.
- Validation: 49 Node tests passed. Browser checks are in progress; teacher evaluation is pending.

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
