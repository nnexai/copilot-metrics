# Release Checklist

This project publishes `copilot-metrics` to npm through GitHub Actions. The human gate is creating the GitHub release or tag that triggers the workflow; the workflow runs verification and then `npm publish`.

## Prerequisites

- GitHub repository exists at `nnexai/copilot-metrics`.
- npm Trusted Publishing is configured for package `copilot-metrics`:
  - Publisher: GitHub Actions
  - Repository: `nnexai/copilot-metrics`
  - Workflow filename: `npm-publish.yml`
  - Allowed action: `npm publish`
- npm package name is available or owned by the publishing account.
- Local working tree is clean before tagging.

## Local Verification

Run:

```bash
npm ci
npm test
npm run check
npm run smoke
npm run verify:package
npm pack --dry-run --json
```

The package must not include `.planning/`, `.codex/`, `test/`, fixture data, local telemetry, or generated SQLite stores.

## Manual Copilot CLI Validation

This is not a CI step because it depends on a local authenticated Copilot CLI and can call external services.

Run setup/dry-run first:

```bash
node scripts/manual-copilot-cli-flow.js --setup-only
```

Run the full local validation from this checkout:

```bash
node scripts/manual-copilot-cli-flow.js --run-prompt --model gpt-5-mini
```

The script creates an example workspace, configures `copilot-metrics`, installs repo-local hook config, temporarily applies user-level Copilot CLI hook settings for the prompt run, imports collected telemetry/hook JSONL, prints report output, and restores the original Copilot settings.

## GitHub Actions Publish

1. Confirm `package.json` contains the release version and README examples match it with `npm run check:readme-version`.
2. Commit all release changes.
3. Push `main`.
4. Create a GitHub release tag that matches the `package.json` version, for example `v$(node -p "require('./package.json').version")`.
5. Confirm the `Node.js Package` workflow passes and publishes to npm through Trusted Publishing.

## Post-Publish Verification

After the workflow publishes:

```bash
VERSION=$(node -p "require('./package.json').version")
npm view copilot-metrics@$VERSION version
npm view copilot-metrics@$VERSION dist.tarball
npx copilot-metrics@$VERSION --help
npx copilot-metrics@$VERSION paths --json
```

## Do Not Publish

- Local telemetry JSONL files
- Generated SQLite stores
- `.planning/` artifacts
- `.codex/` runtime files
- Prompt content or hook logs
