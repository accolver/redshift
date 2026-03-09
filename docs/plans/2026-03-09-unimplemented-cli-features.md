# Unimplemented CLI Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Wire up 5 CLI features that are declared in the CLI spec but have no
implementation: `--mount`/`--mount-format`, `--fallback*`, `--only-names`,
`--plain`, and `secrets download --format`.

**Architecture:** Each feature is a small, self-contained change touching 3
files: the interface (run.ts or secrets.ts), the handler logic (same file), and
the dispatcher (main.ts). TDD — write failing test first, then implement.

**Tech Stack:** Bun, bun:test, TypeScript, node:fs, node:child_process

---

## Task 1: `--only-names` on secrets list

**Files:**

- Modify: `cli/src/commands/secrets.ts` (SecretsOptions + listSecrets)
- Modify: `cli/src/main.ts` (handleSecretsCommand)
- Test: `cli/tests/commands/secrets-output.test.ts` (add tests)

Add `onlyNames?: boolean` to SecretsOptions. In handleSecretsCommand, map
`parsed.flags['only-names']` to `onlyNames: true`. In listSecrets, when
onlyNames is true, print each key on its own line (no values, no table header).

---

## Task 2: `--plain` on secrets get

**Files:**

- Modify: `cli/src/commands/secrets.ts` (SecretsOptions + getSecret)
- Modify: `cli/src/main.ts` (handleSecretsCommand)
- Test: `cli/tests/commands/secrets-output.test.ts` (add tests)

Add `plain?: boolean` to SecretsOptions. In handleSecretsCommand, map
`parsed.flags.plain` to `plain: true`. In getSecret, when plain is true, print
just the value with console.log (unlike raw which uses process.stdout.write
without newline).

---

## Task 3: `secrets download --format` with all 5 formats

**Files:**

- Modify: `cli/src/commands/secrets.ts` (SecretsOptions + downloadSecrets)
- Modify: `cli/src/main.ts` (handleSecretsCommand)
- Create: `cli/tests/commands/secrets-download.test.ts`

Add `downloadFormat`, `noFile`, `filepath` to SecretsOptions. In
handleSecretsCommand, map the download-specific flags. In downloadSecrets,
implement all 5 formats:

- `json`: `JSON.stringify(secrets, null, 2)`
- `env`: `KEY="escaped_value"`
- `yaml`: `KEY: value` (quote values needing it)
- `docker`: `--env KEY=value` lines (for docker run)
- `env-no-quotes`: `KEY=value` (no quoting)

When `noFile` is false (default), write to filepath (default
`secrets.{format}`). When true, print to stdout.

---

## Task 4: `--mount` and `--mount-format` on run command

**Files:**

- Modify: `cli/src/commands/run.ts` (RunOptions + runCommand)
- Modify: `cli/src/main.ts` (handleRunCommand)
- Create: `cli/tests/commands/run-mount.test.ts`

Add `mount?: string` and `mountFormat?: 'env' | 'json'` to RunOptions. In
handleRunCommand, pass the flags through. In runCommand, when mount is set:

1. Format secrets as JSON or env
2. Write to the mount path
3. Set `REDSHIFT_CLI_SECRETS_PATH` env var pointing to the file
4. After child process exits (or errors), delete the mount file in a finally
   block

---

## Task 5: `--fallback*` flags on run command

**Files:**

- Modify: `cli/src/commands/run.ts` (RunOptions + runCommand)
- Modify: `cli/src/main.ts` (handleRunCommand)
- Create: `cli/tests/commands/run-fallback.test.ts`

Add `fallback`, `fallbackOnly`, `fallbackReadonly`, `noFallback` to RunOptions.
In handleRunCommand, pass flags. In runCommand:

- `--fallback <path>`: after fetching secrets from relay, write them to the
  fallback file. If relay fetch fails, read from fallback file instead.
- `--fallback-only`: skip relay entirely, read secrets from fallback file.
- `--fallback-readonly`: read fallback on relay failure, but never write to it.
- `--no-fallback`: disable all fallback behavior (default behavior today).

---

## Task 6: `run clean` subcommand

**Files:**

- Modify: `cli/src/main.ts` (add clean subcommand dispatch)
- Modify: `cli/src/commands/run.ts` (add cleanFallbackFiles function)
- Test: `cli/tests/commands/run-fallback.test.ts` (add tests)

Add `handleRunClean()` that looks for `*.fallback.json` files in the config dir
and deletes them. Wire it up in main.ts when `parsed.subcommand === 'clean'`.
