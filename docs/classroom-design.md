# Classroom workflow: design and verification

## Problem and workflow

The original app offered a large scene task list and a paragraph of guidance. Teachers could demonstrate activities, but could not set a short, ordered activity or review what happened during that activity.

The new workflow connects three capabilities:

| Capability | Classroom behavior | Engineering work |
| --- | --- | --- |
| Teacher planning | Choose up to eight tasks in one scene, order them, write a goal, and edit each task's steps | Validated plan schema and a separate session snapshot |
| Step guidance | Show one instruction at a time, speak that instruction, request nearby teacher help, and use a quieter interface with fewer tools | Session-scoped progress, explicit preferences, and drawing lifecycle integration |
| Activity review | Review only actions from this activity, reload the record, and download CSV | Event accounting, local persistence, input validation, and export escaping |

The classroom additions are a new prototype extension. They have not yet been evaluated by teachers or children. Earlier school feedback described in the main README should not be read as validation of these additions.

## Design basis

W3C's [step-by-step instruction pattern](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/) recommends short steps near the activity, with clear labels and examples. The [personalized interface pattern](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o8p04-interface/) supports changing presentation to suit individual needs.

This implementation applies those ideas through teacher-editable guidance, visible step position, explicit previous/next controls, quiet presentation, and an optional three-tool palette. These are design choices, not an accessibility certification or a claim that every autistic learner prefers the same interface.

## Architecture and state

- `js/classroom-model.js` contains pure validation, session construction, summaries, and CSV serialization. It is tested separately from the DOM.
- `js/classroom-data.js` provides authored Chinese guidance for all 36 built-in tasks and interface labels.
- `js/classroom.js` coordinates the teacher dialog, guidance controls, explicit actions, and local persistence.
- Drawing lifecycle hooks record an accepted pen gesture, accepted undo, and task completion. Speech is requested by the learner; changing steps does not autoplay.
- The active plan is copied before editing. Previous activity reports keep their own plan and goal.

An activity has a generated local ID, a plan snapshot, a start time, an optional end time, and per-task counters. A new activity starts with zero activity completions even when the browser already contains earlier artwork. Repeating completion for the same task remains one completed task.

The separate `creative-classroom:v1` storage record holds the last plan, one current activity, and at most 15 finished activities. There is no student-name field, account, server-side analytics endpoint, or cross-device synchronization. Artwork remains in the existing app storage; CSV reports contain task/action summaries and no images.

## Metric definitions and limits

| Field | Exact meaning | Interpretation limit |
| --- | --- | --- |
| Completed | The task was completed in this activity | Not a drawing-quality score |
| Pen contact seconds | Sum of time between accepted pen-down and pen-end events, rounded to seconds in the report | Includes holding still and eraser gestures; excludes time between gestures |
| Pen gestures | Accepted pen gestures ended while this activity/task was active | Does not estimate skill |
| Undo actions | Accepted undo requests when an undo state exists | Does not measure mistakes |
| Help requests | Activations of the nearby-teacher-help button | Does not verify whether assistance was provided |
| Narration requests | Play requests on the guidance button while speech is not already playing | Does not verify audible playback or comprehension |

Hidden-page handling ends the active gesture. Opening teacher settings also ends the current gesture. A browser crash can lose an unfinished gesture. Clock-based durations use `performance.now()`; report dates use wall-clock time.

Storage failure leaves activity state in memory and displays a persistence warning. Restoration only accepts known scenes/tasks and bounded counters. CSV quotes cells and neutralizes spreadsheet formula prefixes in teacher-entered text.

## Verification

Node tests cover plan validation, teacher step limits, independent activity counts, untrusted restoration data, CSV escaping, pen-contact accounting, and guidance coverage. Existing drawing, speech, storage, and artwork-export checks remain part of the suite.

The browser suite runs in Chromium at desktop and 390-pixel phone widths, with third-party CDN requests blocked. It exercises lesson creation, ordering, custom steps, actual canvas input, quiet mode, help requests, real PNG and CSV downloads, reload, activity completion, text escaping, and dialog bounds. Reports and screenshots are retained as CI artifacts for seven days.

To run locally:

```bash
node --test tests/*.test.cjs
cd tests/browser
npm install --no-package-lock --ignore-scripts
npx playwright install chromium
npm test
```

The browser test server requires Python 3 (`python3` on PATH). Browser test dependencies are isolated from the existing Tailwind build dependencies and pin Playwright to one version.

## Next evaluation

A teacher-first usability session can compare configuring and running a short activity with the earlier open task-list flow. Use the same task set, vary the order of the two flows, and record setup time, navigation errors, and teacher feedback on instruction wording and tool choices.

This is a proposed evaluation, with no study results reported. Educational benefit, learner preference, assistive-technology behavior, and real classroom use still require separate evaluation.
