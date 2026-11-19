# Asset Notes

## Local Visual Assets

The local scene backgrounds and drawing reference images in `assets/scenes/` and `assets/references/` were generated and prepared specifically for the Creative Drawing App project. They were not copied from the third-party hotlink URLs that appeared in earlier development versions.

This statement records project provenance; it does not assign a public license. The project owner should make any future licensing or redistribution decision explicitly.

## Placeholders

The files in `assets/placeholders/` are project-specific loading and image-error placeholders used by the image fallback system.

## Remaining Remote Content

Some non-core references and optional backgrounds still load from external sources. They are not part of the local asset set, and their availability and redistribution terms are not guaranteed. See [assets-to-replace.md](assets-to-replace.md) for the current replacement list.

## Audit Records

- `assets/replacement-slots.json` records the current localization status of the original priority replacement slots.
- `assets/image-inventory.json` is a historical image audit snapshot from before the current localization work. It must not be treated as a live inventory of the application.

## Interface Icons

Interface pictograms come from the official [Lucide static SVG package, version 0.468.0](https://github.com/lucide-icons/lucide/tree/0.468.0). The application embeds the selected vectors as local CSS masks in `css/icons.css` and uses Lucide artwork in the image placeholders. The masks inherit each control’s text color and work offline.

The [bundled license notices](assets/licenses/lucide.txt) cover Lucide contributors’ ISC-licensed work and the MIT-licensed Feather portions by Cole Bemis.
