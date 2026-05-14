# Dusi Script Catalog Template

Free catalog template for publishing Dusi scripts without Firebase.

## Structure

- `index.json` - catalog index consumed by app.
- `scripts/*.json` - individual script files (one Script object per file).

## How to use with GitHub

1. Create a public repository, for example `dusi-script-catalog`.
2. Copy this folder content to repository root (or keep in a subfolder and update paths).
3. Commit and push.
4. Use Raw URL for `index.json`, for example:
   - `https://raw.githubusercontent.com/UUSR/dusi-script-catalog/main/index.json`
5. In app, fetch `index.json`, render list, then fetch selected script by `fileUrl`.

## Index format

Each entry in `scripts` should include:

- `id` - stable unique id.
- `name`, `description`, `tags`.
- `version` - increment on updates.
- `filePath` - relative path inside repo.
- `fileUrl` - full raw URL to the script JSON.
- `checksumSha256` - optional, for integrity check.
- `author`, `createdAt`, `updatedAt`, `isPublic`.

## Script format

Each script file is exactly one object compatible with app `Script` type:

- `id`, `name`, `description`, `events`, `actions`, `enabled`, `createdAt`, `updatedAt`, `tags`.

## Moderation workflow

- Community adds scripts via Pull Request.
- Maintainer reviews and merges.
- Catalog updates instantly after merge.
