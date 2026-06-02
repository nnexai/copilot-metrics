# VS Code Chronicle Session Indexing

**Date:** 2026-06-02
**Scope:** Evaluate whether VS Code Copilot Chat `/chronicle` and local session indexing help `copilot-metrics` fallback discovery, attribution, or pricing evidence.

## Public Source Findings

- VS Code exposes `github.copilot.chat.localIndex.enabled`, described as local session tracking for session insights and `/chronicle` commands.
- GitHub's April 2026 VS Code Copilot changelog describes `/chronicle` as an experimental feature that tracks chat interactions in a local database so users can search past sessions, recall work, and get personalized workflow tips.
- VS Code session sync docs say local session tracking is a prerequisite for sync. Session sync can include local agent sessions and is private to the user unless explicitly shared.
- Copilot CLI docs describe a similar session-store model: complete session files plus a local SQLite session store powering `/chronicle`, free-form history questions, and reindexing from session files.

Sources:

- https://code.visualstudio.com/docs/copilot/reference/copilot-settings
- https://code.visualstudio.com/docs/copilot/chat/session-sync
- https://github.blog/changelog/2026-05-06-github-copilot-in-visual-studio-code-april-releases/
- https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agents/copilot-cli/chronicle
- https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/chronicle

## Local Machine Findings

The user enabled and ran `/chronicle reindex` in VS Code Insiders. Local files show:

- `~/.config/Code - Insiders/User/globalStorage/github.copilot-chat/session-store.db`
- `~/.config/Code - Insiders/User/workspaceStorage/dce4bb421e965572b9221e183cedcef6/GitHub.copilot-chat/debug-logs/<session-id>/main.jsonl`
- `~/.config/Code - Insiders/User/workspaceStorage/dce4bb421e965572b9221e183cedcef6/GitHub.copilot-chat/transcripts/<session-id>.jsonl`
- `~/.config/Code - Insiders/User/workspaceStorage/dce4bb421e965572b9221e183cedcef6/GitHub.copilot-chat/codebase-external.sqlite`

`session-store.db` is SQLite and contains:

- `sessions`: `7` rows
- `turns`: `2` rows
- `session_files`: `0` rows
- `session_refs`: `0` rows
- `checkpoints`: `0` rows

The `sessions` table schema includes `id`, `cwd`, `repository`, `host_type`, `branch`, `summary`, `agent_name`, `agent_description`, `created_at`, and `updated_at`.

The `turns` table schema includes `user_message` and `assistant_response`, so this database can contain sensitive prompt and response content.

The `search_index` table is an FTS5 virtual table with `content`, `session_id`, `source_type`, and `source_id`, which confirms that `/chronicle` creates searchable content locally.

The local indexed session count matches the debug-log directories:

- `2dacd5bb-bc4b-45c3-ab50-81e3a944f101`
- `6ba4d714-1cd2-4cd8-916c-ab9a1f25a403`
- `a4758810-5384-402a-9735-586b932f8a7c`
- `bd1ff034-cc74-4a99-a626-b7933d7964cc`
- `c593e39c-9fd1-4a3b-bad2-e16484430067`
- `d86f0592-24b3-47f9-8eb3-82a6a5939d9d`
- `eb8359d1-74d7-4c06-b1f5-47a3ecbcd7aa`

Only five matching transcript files were present in the inspected workspace transcript directory. This matters because the session store and debug-log directories can reveal sessions that transcript-only discovery would miss.

The current debug logs for those seven sessions contained no `llm_request` rows and no `cachedTokens` fields:

```text
2dacd5bb-bc4b-45c3-ab50-81e3a944f101 lines=2 llm=0 cachedTokens=0 tokenish=0
6ba4d714-1cd2-4cd8-916c-ab9a1f25a403 lines=1 llm=0 cachedTokens=0 tokenish=0
a4758810-5384-402a-9735-586b932f8a7c lines=2 llm=0 cachedTokens=0 tokenish=0
bd1ff034-cc74-4a99-a626-b7933d7964cc lines=1 llm=0 cachedTokens=0 tokenish=0
c593e39c-9fd1-4a3b-bad2-e16484430067 lines=2 llm=0 cachedTokens=0 tokenish=0
d86f0592-24b3-47f9-8eb3-82a6a5939d9d lines=1 llm=0 cachedTokens=0 tokenish=0
eb8359d1-74d7-4c06-b1f5-47a3ecbcd7aa lines=1 llm=0 cachedTokens=0 tokenish=0
```

`codebase-external.sqlite` appears to be codebase indexing rather than chat history. It had `Files` and `Metadata` tables, with `Files` empty in the inspected workspace.

## Interpretation

Chronicle helps `copilot-metrics`, but mainly as a session inventory and attribution source, not as a direct pricing source.

Useful fields:

- session ID
- host type
- cwd
- repository URL
- branch
- agent name
- created and updated timestamps
- searchable linkage to turns, files, and references when present

Not observed in Chronicle's `session-store.db` as useful pricing evidence:

- prompt tokens
- completion tokens
- cache-read tokens
- cache-write tokens
- actual AI Credit charge
- `totalNanoAiu`

Important correction: VS Code chat session JSONL files are a separate source from the Chronicle SQLite index, and they can contain usage fields. Local `chatSessions/*.jsonl` evidence included `result.metadata.promptTokens`, `result.metadata.outputTokens`, `toolCallRounds[].thinking.tokens`, model IDs, and display strings such as `GPT-5 mini - 0x` or `GPT-5 mini - 0.8 credits`. These are session-file usage/display fields, not Chronicle-index fields.

The current v0.1.9 debug-log cached-token parser is still the stronger VS Code cache-read pricing path when `llm_request.attrs.cachedTokens` exists. On this machine, the seven reindexed sessions did not contain such rows in the debug logs, so no new numeric cache-read evidence was available from Chronicle reindexing alone.

## Recommended Product Direction

Add a future optional VS Code Chronicle/session-store discovery source with privacy-preserving defaults:

- Read `session-store.db` metadata from VS Code stable and Insiders global storage.
- Use `sessions` rows to enumerate session IDs, `cwd`, repo, branch, and timestamps.
- Join that metadata to workspace `GitHub.copilot-chat/debug-logs/<session-id>/main.jsonl` and `transcripts/<session-id>.jsonl` when those files exist.
- Continue parsing `chatSessions/*.jsonl` for request-level token and display-credit fields where available.
- Do not read `turns.user_message`, `turns.assistant_response`, or FTS `content` unless the user explicitly enables content capture.
- Treat session-store rows as attribution and diagnostics evidence, not token or billing evidence.
- Surface a diagnostic such as `chronicle_indexed_session_without_token_metrics` when a Chronicle session is discovered but no token-bearing transcript, OTel span, or debug-log request row is found.

This would improve coverage for sessions that are indexed locally but missing from the transcript directory. It should be a future phase because it adds SQLite parsing of VS Code-internal files and needs fixture coverage for schema drift and privacy controls.
