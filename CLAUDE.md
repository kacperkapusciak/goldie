# goldie

## Branching and releases

- All development happens on the `develop` branch. Base feature branches on `develop` and point PRs at `develop`, never at `main`.
- `main` holds released code only. To release: merge `develop` into `main`, tag the version, and publish the package from `main`.
- The GitHub default branch must stay `main` so `npx skills` installs the released version. Set PR bases to `develop` explicitly.

## Testing local changes in another app repo

Instead of `npx -y goldie@0 <cmd>`, run the CLI from source (no build step):

```bash
GOLDIE_CONFIG=$PWD/goldie/goldie.config.ts bun <goldie-repo>/src/cli.ts <cmd>
```

If the studio changed, run `bun run build:studio` first. For pre-publish verification, `bun run build && npm pack` in the goldie repo, then `npx -y <goldie-repo>/goldie-<version>.tgz <cmd>` from the app repo.

## Bundled assets

When adding an asset to `assets/` (fonts, bezel art, images), record its
attribution: list it with source, copyright, and license in
`assets/ATTRIBUTION.md`, and for fonts also add the copyright notice to
`assets/fonts/OFL.txt`. Check that the file is covered by the `files` field in
`package.json` so it ships with the npm package.

## References

- App Store screenshot specifications (required sizes per device, formats, limits):
  https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
