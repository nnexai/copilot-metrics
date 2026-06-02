# Research Summary: v0.1.8 Session Log Fallback

**Date:** 2026-06-02
**Basis:** Current official GitHub Copilot CLI docs, VS Code Copilot session-sync docs, Microsoft VS Code issue evidence, and existing `copilot-metrics` source review.

## Key Findings

**Stack:** No new service or storage layer is needed. The existing Node.js JSONL ingestion, SQLite store, idempotent raw record fingerprints, and report auto-import flow already support adding session logs as normal configured sources.

**Table Stakes:** Session-log fallback must discover VS Code stable, VS Code Insiders, and Copilot CLI locations automatically, parse supported session records into normalized usage records, run the same label extractor callback, and produce clear diagnostics when logs do not contain token metrics.

**Watch Out For:** VS Code session files are local user data and can include prompt/response content. The fallback should use them for label extraction and session linkage without storing full prompts by default. Copilot CLI session data is documented under `~/.copilot/session-state`, but `COPILOT_HOME` can relocate the whole tree.

## Source Notes

- GitHub documents the Copilot CLI config directory as `~/.copilot` by default and lists `session-state/` as the session history and workspace data directory.
- GitHub documents `COPILOT_HOME` as an override for the entire Copilot CLI config directory, so fallback discovery should respect `COPILOT_HOME` before using `~/.copilot`.
- VS Code documents Copilot session sync and local session tracking, including that users can keep sessions local only.
- Microsoft VS Code issue evidence shows local Copilot chat history stored under platform VS Code user data `workspaceStorage/<workspace>/chatSessions/`, with `state.vscdb` indexing the sessions.
- Existing `copilot-metrics` already has `vscode-chat` and `copilot-session` import paths, but the default config only persists Copilot CLI session discovery and does not persist VS Code/Insiders chat session fallback paths.

```text
VS Code OTel, if present             \
Copilot CLI OTel, if present          \
Hooks, if present                      -> configured source auto-import -> normalized local store -> reports
VS Code/Insiders chat session fallback/
Copilot CLI session-state fallback    /
```

## Implementation Implications

- Promote session-log fallback from opportunistic discovery to an explicit setup/config source for VS Code stable, VS Code Insiders, and Copilot CLI.
- Keep `runLabelExtractors(sourceType, sourceData, customExtractors)` as the single label callback for fallback data. Do not add a parallel label API.
- Ensure fallback source data includes prompt candidates, cwd, repo, branch, task hint, session ID, conversation ID, and explicit labels when present.
- Preserve idempotence with source plus file plus line/fingerprint or stable session-event identifiers, especially for Copilot CLI session files that may not be append-only in every future format.
- Add fixture coverage for Linux/macOS/Windows default path discovery, VS Code `.jsonl` and `.json` chat session shapes, Copilot CLI `events.jsonl`, missing/unreadable diagnostics, and custom extractor invocation.
- Document privacy: fallback session logs may contain content locally, but `copilot-metrics` should not persist full prompts unless content capture is explicitly enabled.

## Follow-up: VS Code Chronicle Session Indexing

See `2026-06-02-vscode-chronicle-session-indexing.md`.

VS Code `/chronicle` and `github.copilot.chat.localIndex.enabled` create a local SQLite session index that can improve session discovery and attribution. Local validation found exactly seven indexed VS Code Insiders sessions in `User/globalStorage/github.copilot-chat/session-store.db`, matching seven `GitHub.copilot-chat/debug-logs/<session-id>/` directories. The session store exposes useful metadata such as session ID, cwd, repository, branch, host type, and timestamps, but it also stores prompt/response text and FTS content, so `copilot-metrics` should not read content tables unless content capture is explicitly enabled.

Chronicle indexing should be treated as an optional future discovery source, not a pricing source. On the inspected machine, the seven debug-log `main.jsonl` files contained no `llm_request` or `cachedTokens` rows, so no new token or cache-read evidence was available from Chronicle reindexing alone.

## Sources

- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference
- https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agents/copilot-cli/chronicle
- https://code.visualstudio.com/docs/copilot/chat/session-sync
- https://github.com/microsoft/vscode/issues/301793
