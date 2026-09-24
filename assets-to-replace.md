# Non-Core Assets to Replace

The core scene covers, default backgrounds, and nineteen priority visual assets have been localized. The items below are non-core resources. The application provides per-image fallback behavior if they are unavailable, so they are not release-blocking for the core drawing flow.

Any replacement added to this repository should be self-created, generated for the project, user-owned, Public Domain, CC0, or covered by explicit redistribution permission. Do not copy the current hotlinked files into the repository without confirming their source and terms.

## Optional Scene Backgrounds

- Beach: `beach-sunset` (sunset beach).
- Aquarium: `aquarium-seaweed`, `aquarium-light`, and `aquarium-blue`.

The aquarium light and blue options currently use signed or expiring-style Huaban URLs. These are especially unsuitable as long-term public repository assets.

## Forest References

- `flower1` (花朵1).
- `flower2` (花朵2).

`flower1` remains the one unresolved slot in `assets/replacement-slots.json`. Its previously proposed local path is `./assets/references/forest/flower-1.png`, but no file should be created until a license-safe replacement is supplied.

## Starry Scene References

- `star1`, `star2`, `star3`, `star4`, and `star5`.
- `moon1` and `moon2`.

These task references currently depend on external image-hosting URLs.

## Town References

- `house1` and `house2`.
- `house4` through `house9`.

`house3` is already local and is not part of this replacement list.

## Aquarium References

- `seahorse`, `jellyfish`, `seaweed`, `coral`, `treasure`, `anchor`, and `diver`.

These include Google search thumbnail URLs and signed or expiring-style Huaban URLs. They should be replaced with project-owned or explicitly licensed local files when suitable artwork is available.

## Replacement Record

For each future local replacement, record:

- File name and task/background identifier.
- Creator or source.
- License or permission basis.
- Original source URL when applicable.
- Required attribution, or confirmation that none is required.

The historical source checks in `assets/image-inventory.json` predate the current localization work and do not represent a live asset inventory.
