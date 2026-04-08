# discord

Agent-first Discord administration CLI built on Bun and `argc`.

This repository was rebuilt from an untrusted fork. The current version keeps the CLI narrow, machine-readable, and discoverable through schema introspection instead of hand-written command manuals.

## Design Goals

- Default to `toon` because the primary consumer is an agent.
- Keep `json` only for machine piping such as `jq`.
- Resolve global configuration once at the edge and expose the final result through context.
- Prefer `--schema` discovery over duplicating argument detail across docs.

## Install

```bash
bun install
```

## Develop

```bash
bun run fmt
bun run check
```

## Run

```bash
bun run src/main.ts --help
bun run src/main.ts --schema
```

To use it as a local command:

```bash
bun link
discord --schema
```

## Build

Bundle TypeScript source into a single executable JS file for container distribution:

```bash
bun run build
```

Output lands at `dist/discord` with a shebang (`#!/usr/bin/env bun`) and executable permission, ready to run directly.

### Container integration

Install the Bun runtime once, then COPY the build artifact:

```dockerfile
FROM oven/bun:1-slim AS build
WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile && bun run build

FROM oven/bun:1-slim
COPY --from=build /src/dist/discord /usr/local/bin/discord
```

Multiple Bun CLI tools share a single runtime — each tool adds only ~100 KB.

## Output Modes

Default output is `toon`.

```bash
discord server list
discord server list --format json | jq .
```

## Configuration

Persistent configuration is optional. When present, it lives at:

```text
~/.config/discord/config.json
```

Supported file keys:

- `token`
- `server`
- `format`

Every config key can be overridden by environment variables:

```bash
DISCORD_TOKEN=...
DISCORD_SERVER=...
DISCORD_FORMAT=toon
DISCORD_CONFIG_DIR=/path/to/config
```

Resolution order:

1. CLI globals
2. Environment variables
3. Optional config file
4. Built-in defaults

There is no `init` command. If the required environment or config is missing, the CLI exits with a structured error payload.

## Quick Start

```bash
DISCORD_TOKEN=... discord server list
discord server select <SERVER_ID>
discord --schema=.message.search
discord message search general deploy --limit 10
```

## Discord API Notes

This fork corrects several stale assumptions from the previous codebase:

- `PIN_MESSAGES` became a standalone permission on February 23, 2026.
- `CREATE_GUILD_EXPRESSIONS` / `create_expressions` is separate from the older emoji permission model.
- Message search uses guild search instead of pretending that recent channel history is equivalent.
- Pin listing uses the newer `/channels/{id}/messages/pins` API shape.

## Publishing Note

The local package name is `discord` because that is the current project name. If you ever publish it, use a scoped package instead of relying on an obviously crowded global name.
