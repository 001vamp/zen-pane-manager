# Release checklist

## Code and metadata

- [ ] `theme.json`, `package.json`, and `CHANGELOG.md` use the same version.
- [ ] `npm test` passes.
- [ ] The compatibility matrix is complete for the target Zen release.
- [ ] No private URLs, tab titles, profile paths, or local machine data are present.
- [ ] License and attribution notices remain intact.

## Visual review

- [ ] Light and dark glass defaults are readable.
- [ ] Narrow, standard, wide, and extra-wide picker settings remain usable.
- [ ] One-, two-, and three-column compact layouts were checked.
- [ ] Keyboard focus, reduced motion, and high-DPI text were checked.
- [ ] Capture a current 600×400 PNG without private browsing information for marketplace submission.

## GitHub release

- [ ] Push the release commit to `main`.
- [ ] Create a `vX.Y.Z` tag matching the manifest version.
- [ ] Create release notes from `CHANGELOG.md`.
- [ ] Verify the validation workflow passes.
- [ ] Test a clean Sine installation from `001vamp/zen-split-swap`.

## Marketplace

- [ ] Confirm the repository is public.
- [ ] Confirm README, screenshot, source license, and preferences meet current Sine requirements.
- [ ] Submit through Sine's official marketplace issue template.
