# Creative Drawing App / 创意小画家

Project updates: [Changelog](CHANGELOG.md).

Special thanks to the teachers at Wenzhou Special Education School (温州市特殊教育学校) for trying the prototypes and providing practical feedback that helped improve the application. This acknowledgement describes educational collaboration and does not imply official endorsement by the school.

Creative Drawing App is a student-developed interactive teaching-aid prototype, not simply a browser drawing demo. It was created in a special-education context and primarily designed with the needs of children on the autism spectrum in mind. The application combines approachable drawing tasks, visual references, spoken guidance, and immediate feedback in a classroom-oriented workflow.

The project was developed through hands-on implementation, instructor review, and practical feedback from teachers at Wenzhou Special Education School (温州市特殊教育学校). It is an educational support project, not a clinical, diagnostic, or therapeutic product.

## Why This Project Exists

The project began in October 2025 under the guidance of Dr. Pinata Winoto. Dr. Winoto proposed exploring digital drawing as a teaching activity, and this student team focused on turning that idea into an interactive drawing prototype for special-education classroom use. Within the broader project setting, another student group explored a paper-cutting activity while this team concentrated on digital drawing.

The aim was to make drawing activities easier to approach through simple interactions, clear tasks, child-friendly scenes, reference materials, and multimodal guidance. The project does not assume that all autistic children have the same needs, and it does not claim therapeutic or medical effects.

## Working with Wenzhou Special Education School

The team shared prototypes and demonstrations with teachers at Wenzhou Special Education School. Teachers tried the application and provided practical feedback about classroom use, visual presentation, drawing guidance, tool choices, and interaction problems. The student team used this feedback to revise both the design and the implementation.

Throughout development, the team also regularly reviewed progress, current prototypes, drawing tools, revisions, and next steps with Dr. Pinata Winoto. This was teacher-informed iterative development and real-world educational collaboration, not a formal clinical study or controlled experiment.

## From Teacher Feedback to Design

| Feedback or observation | Design response in the current project |
| --- | --- |
| Voice guidance did not always trigger reliably during trial use. Teachers also suggested that short video-style guidance might be useful. | Browser-based text-to-speech guidance was added and refined, including selectable Chinese voices and spoken task instructions. Instructional video is not implemented and remains a future suggestion. |
| Earlier realistic photographs were not visually playful enough for the intended children. | Core scene visuals moved toward brighter, child-friendly illustrated environments. |
| Some children may find it difficult to simplify a photograph of a real object into a drawing. Teachers discussed a progression from real-object views to line drawings and completed illustrations. | The application provides task reference materials and a tracing mode. Not every task currently provides all proposed reference stages. |
| Teachers suggested more immediate encouragement after completing drawing elements. | The current version provides completion messages, scene progress updates, completed-work previews, and an optional celebration effect. Spoken praise and sound-effect rewards are not currently implemented. |
| A wider variety of drawing tools was discussed, including asking teachers which tools children preferred. | The toolbar now includes fineliner, crayon, watercolor, pencil, brush, spray, oil-paint-style, and eraser tools, together with color and size controls. |
| Trial use revealed concrete interaction problems, including an unresponsive continue-drawing flow and eraser behavior that could leave unwanted white areas over the scene. | Later iterations corrected navigation and drawing-flow behavior and made the eraser clear drawing pixels without painting an opaque white layer. |

These examples show how teacher feedback affected actual design and engineering decisions. They do not imply that every suggestion has already been implemented.

## Eleven Iterations

The current version is the result of eleven internal development iterations rather than a single prototype. The original working file name `demo11` reflects the eleventh development version.

Each cycle incorporated some combination of prototype development, instructor review, teacher feedback, interface revision, feature adjustment, bug fixing, and further testing. The eleven versions were internal development iterations; they should not be interpreted as eleven formal school testing sessions.

## What the App Supports Today

- Five themed drawing scenes: beach, forest, starry sky, town, and aquarium.
- Teacher-planned activities with selected task order, editable step instructions, and an activity goal.
- Step-by-step guidance for all 36 tasks, optional quiet presentation, and a simpler tool palette.
- Anonymous local activity review with explicit action counts and CSV export.
- Guided drawing tasks with instructions and reference materials.
- Fineliner, crayon, watercolor, pencil, brush, spray, oil-paint-style, and eraser tools.
- Brush size and color controls, undo, and protected canvas clearing.
- Trace and free-drawing modes.
- User-uploaded reference images with local validation.
- Selectable scene backgrounds.
- Task completion and scene progress tracking.
- Local draft, artwork, progress, position, and preference persistence.
- Browser text-to-speech with automatic Mandarin voice selection, all available Chinese voices, voice previews, and saved speech-speed preferences.
- Artwork preview, local PNG downloads of saved task artwork, and a story presentation flow.
- Safe local/static story fallback; the public version does not use a live AI backend.
- Image loading states, error placeholders, and per-image failure isolation.
- Responsive desktop and mobile layout with a mobile-friendly drawing toolbar.

## Classroom Workflow

Open **教师工作台** to arrange a short activity. Select the scene and tasks, reorder them, edit the instruction steps, and choose quiet presentation or a simpler tool palette. Start the activity to show the selected tasks in that order.

In the drawing screen, **上一步 / 下一步** changes the visible instruction. **听老师讲解** reads the current step. **请老师帮忙** provides a prompt to ask a nearby teacher and records that button request.

Reopen the workbench to review the current activity or finish it. Reports show activity completions, cumulative pen-contact time, pen gestures, undo actions, help requests, and narration requests. Download a CSV to keep the record. These values describe operations, not learning, attention, clinical progress, or drawing quality.

This classroom workflow is a new prototype extension awaiting teacher evaluation. See [the design and verification notes](docs/classroom-design.md) for architecture, metric definitions, tests, and the proposed evaluation.

## Design Principles

The project emphasizes simple interactions, clear visual hierarchy, child-friendly illustrations, multimodal guidance, task-based progression, immediate feedback, low-friction navigation, and classroom practicality. These are design aims shaped by project experience and teacher feedback, not claims of formal accessibility certification.

## Team

### Faculty Instructor / Advisor

- Dr. Pinata Winoto

Dr. Winoto proposed the initial exploration of digital drawing as a teaching activity. The team regularly reviewed progress and design decisions with Dr. Winoto throughout development.

### Student Team

- Linkai Wang
- Yiyang Peng
- Yuming Huang
- Huajia Chen
- Yutong Ge

**Development and technical implementation:** Linkai Wang and Yiyang Peng were primarily responsible for implementation and coding, with contributions and discussion across the team.

**School communication and feedback coordination:** Yuming Huang, Huajia Chen, and Yutong Ge were primarily responsible for communicating with teachers at Wenzhou Special Education School, collecting feedback, and helping coordinate the iteration process.

### Acknowledgements

## Technical Overview

The application uses vanilla HTML, CSS, and JavaScript with an HTML Canvas drawing surface. Its feature code is organized into classic JavaScript modules, Tailwind CSS is precompiled for production, and drafts and progress are stored through browser `localStorage`. Spoken instructions use the browser Speech Synthesis API, and relative resource paths support GitHub Pages project-site deployment.

## Project Structure

```text
creative-drawing-app/
├── index.html                  # Static application entry point
├── css/
│   ├── tailwind.css            # Compiled production CSS
│   ├── tailwind-input.css      # Tailwind source entry
│   └── style.css               # Project-specific styles
├── js/                         # Application modules
├── assets/
│   ├── scenes/                 # Local scene backgrounds
│   ├── references/             # Local drawing references
│   ├── placeholders/           # Image loading/error placeholders
│   └── README.md               # Asset folder guide
├── ASSETS.md                   # Asset provenance notes
├── assets-to-replace.md        # Remaining non-core remote assets
├── package.json                # CSS build scripts
├── pnpm-lock.yaml              # Locked build-tool dependencies
├── tailwind.config.cjs         # Tailwind configuration
└── README.md
```

The files `assets/image-inventory.json` and `assets/replacement-slots.json` are audit records. The image inventory is a historical snapshot rather than a live description of the current application; the replacement-slot file records the current localization status of the original priority assets.

## Running Locally

The application is a static website. The compiled CSS and application JavaScript are already committed, so ordinary users do not need Node.js or a build step.

From the repository root, start any standard static HTTP server. For example:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000/](http://localhost:8000/) in a modern browser.

Opening `index.html` directly by double-clicking it is not the primary supported method because browser storage and security behavior can differ from an HTTP deployment.

## Voice Guidance

In the drawing screen, use **老师的声音** to choose a voice, **试听声音** to hear a short drawing example, and **讲解语速** to adjust the pace. Click **保存偏好** to remember the voice and speed in this browser. **自动推荐** prefers Mandarin voices and prioritizes voices explicitly labeled Natural, Neural, Premium, or Enhanced when the browser exposes them. Existing manually saved voice choices remain selected when available.

The app preserves the voice's original pitch and waits briefly for voices that load after the page opens. It lists every available Chinese voice instead of limiting the picker to the first three. Online voices are marked **需联网** and may require a working network connection.

Voice availability and sound quality still depend on the browser and operating system. The browser API cannot create a neural voice that the device does not provide, and a voice without a quality label may still sound good. If the list contains only basic voices, compare another browser or install additional Chinese speech voices. This change does not add a paid speech API or a server, and it does not produce prerecorded narration.

To run the speech selection and playback regression checks with Node.js, use `node --test tests/tts.test.cjs`. These checks simulate browser voice loading and events; they do not measure perceived voice quality or replace listening on the target device.

## Automated Regression Checks

Run all checks with Node.js 24 or later:

```bash
npm test
```

No dependency installation is needed for these tests. Alternatively, run `node --test tests/*.test.cjs` directly.

The suite covers speech voice selection and playback events, draft restoration and retention, malformed or oversized saved data, unavailable browser storage, and validation of restored artwork, positions, and backgrounds. Drawing workflow tests also simulate interrupted strokes, page exit events, autosave, and restoration in a new session. Export tests cover PNG conversion requests, invalid images, duplicate clicks, cleanup, and cancellation when the selected artwork changes. GitHub Actions runs the suite on pushes and pull requests.

The Node checks use simulated browser APIs. A separate Classroom browser checks workflow runs Chromium at desktop and phone widths, with external CDN requests blocked. It exercises actual canvas input, PNG/CSV downloads, reload and teacher/student workflow controls. Browser reports and screenshots are retained as CI artifacts. Real device speech quality, assistive technology and classroom outcomes still require separate evaluation.

## Building the CSS

Only developers changing Tailwind-based styles need to install the build dependency and regenerate the compiled stylesheet:

```bash
pnpm install
pnpm run build:css
```

For development with automatic rebuilding:

```bash
pnpm run watch:css
```

Tailwind's runtime CDN is not used in production. The generated `css/tailwind.css` file is committed to the repository.

## Deployment

This project can be deployed as a static GitHub Pages project site. All first-party application resources use relative paths, so deployments under a repository subpath are supported, for example:

```text
https://username.github.io/repository-name/
```

A typical deployment can publish the repository root from the default branch. No server-side runtime or secret configuration is required for the current public version.

## Downloading Artwork

Complete a drawing task, choose **查看作品**, and click **下载作品（PNG）**. The browser starts a download named after the scene and task. The conversion runs locally and does not upload the artwork.

The PNG contains the saved task drawing with its transparency. Export preserves the saved image's dimensions; completed-task snapshots currently have a maximum longest edge of 320 pixels. This is not a full-resolution export of the original canvas or a composite of the entire scene.

## Local Data

The application runs primarily in the browser. Drawing progress, saved drafts and artwork, and related preferences are stored in the browser's `localStorage`. The public version does not provide a cloud database or user-account system. Data is specific to the current browser origin, and clearing site data will remove locally stored progress.

Uploaded reference images are processed locally for the current drawing workflow. Users should not upload sensitive personal images when using a shared or public device.

The classroom workflow uses a separate local record for the last activity plan, the current activity, and up to 15 completed activity reports. Records have generated local IDs and no student-name field. Clearing this site's data also removes these records.

## External Dependencies

- [Font Awesome 4.7](https://fontawesome.com/v4/) for interface icons.
- [canvas-confetti 1.6.0](https://www.npmjs.com/package/canvas-confetti) for optional completion feedback.
- [Google Fonts — Nunito](https://fonts.google.com/specimen/Nunito) for the preferred interface typeface; system fonts provide a fallback.
- [Tailwind CSS 3.4.17](https://v3.tailwindcss.com/) as development-time CSS build tooling.

The first three browser resources are loaded from HTTPS CDNs. A CDN failure may affect icons, typography, or the optional completion effect, but the core drawing canvas does not depend on those enhancements. Some non-core content images also remain remote; see [assets-to-replace.md](assets-to-replace.md).

## Known Limitations

- Some non-core scene options and drawing references still use external URLs. Those images may become unavailable, but the application provides a per-image fallback.
- The source and redistribution terms of the remaining remote images require review before they are localized.
- Story mode currently uses a safe local/static fallback rather than a live AI service.
- Available text-to-speech voices and voice quality depend on the browser and operating system.
- Progress is stored only in the local browser and is not synchronized across devices.
- Opening `index.html` directly by double-clicking it is not the primary supported execution method.

## Licensing

This repository does not currently include a source-code `LICENSE` file. A source-code license has not yet been selected and remains a decision for the repository owner. Source-code licensing is separate from the status of visual assets; see [ASSETS.md](ASSETS.md) for asset provenance and licensing notes.

## Privacy and Media

This repository does not intentionally publish student names, individual diagnoses, health information, identifiable classroom records, or student photographs. If classroom media is added in the future, only material with appropriate permission and without sensitive student information should be published.

Private chat screenshots and communication records used to reconstruct the project history are not included in the public repository. Teacher feedback is summarized anonymously rather than quoted from private messages.

No claim about formal ethics approval, parental consent, or clinical validation is made by this documentation.

For additional asset information, see [ASSETS.md](ASSETS.md) and [assets/README.md](assets/README.md).
