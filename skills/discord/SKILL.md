---
name: discord
description: >-
  Operate Discord servers from a CLI: inspect servers, channels, roles, members,
  permissions, messages, invites, emojis, and audit logs. Use when a task
  involves Discord moderation, server administration, message operations, or
  repeated Discord workflows.
---

## Execution Rules

- `discord` is a CLI tool. Run it directly.
- Start with schema discovery instead of guessing command names or flags.
- Before destructive actions, inspect the target first and then re-run with `--confirm` when required.
- If a command fails, read the error payload and satisfy the missing prerequisite before retrying.

## First Move: discover the surface

At the start of a Discord task:

```bash
discord --schema
```

Then narrow to the relevant capability:

```bash
discord --schema=.server
discord --schema=.channel
discord --schema=.member
discord --schema=.message
discord --schema=.permission
```

Before calling a specific operation, inspect that exact command:

```bash
discord --schema=.message.search
discord --schema=.role.edit
discord --schema=.permission.set
```

## Capability Map

Use this tool when the job is about any of these:

- Server inspection and server settings
- Invite management
- Channel creation, deletion, movement, cloning, and slowmode
- Role creation, editing, assignment, and removal
- Member lookup, inspection, kick, ban, and nickname changes
- Channel permission overwrites
- Message send, edit, delete, search, reaction, pin, thread, and attachment download
- Emoji management
- Audit log inspection

## Working Style

### Inspect state first

Use read-style commands before mutating:

```bash
discord server info
discord channel list
discord role list
discord member info alice
discord permission view general
discord audit log --limit 20
```

### Then perform one precise action

```bash
discord channel create release-notes --type announcement
discord role edit moderators --permissions pin_messages,create_expressions
discord member kick alice --confirm
discord message search general deploy --limit 10
```

### Prefer exact member references

Member search is intentionally strict. Use a full username, full nickname, full global display name, or a numeric user ID. Do not rely on short prefixes for moderation commands.

## Programmable Workflows

Yes, an agent can need workflow-style usage here, especially for:

- Repeating the same mutation across multiple channels or roles
- Running a small sequence of Discord actions in one invocation
- Keeping a Discord operation self-contained instead of spawning many shell calls

`argc --run` gives you a lightweight TypeScript eval/module mode.

### Inline script example

Send the same message to several channels:

```bash
discord --server "$SERVER_ID" --run '
for (const channel of ["release-notes", "ops", "mods"]) {
  await argc.call["message.send"]({
    channel,
    text: ["Deploy starts in 10 minutes."]
  })
}
'
```

### Module script example

```bash
discord --server "$SERVER_ID" --run @./scripts/discord-lockdown.ts
```

```ts
export default async function (argc) {
	for (const channel of ['general', 'support']) {
		await argc.call['permission.lock']({ channel })
	}
}
```

### When `--run` is a good fit

- Batch actions
- Ordered multi-step mutations
- Small imperative automation driven by known targets

### When plain commands are better

- One-off inspection
- One-off mutations
- Tasks where you still need to discover the command surface first

## Common Patterns

### Investigate a server

```bash
discord server info
discord channel list
discord role list
discord audit log --limit 50
```

### Moderate a member

```bash
discord member info alice
discord member kick alice --confirm
```

### Adjust channel permissions

```bash
discord permission view general
discord permission set general moderators --allow send_messages,embed_links
discord permission lock general
```

### Work with messages

```bash
discord message read general --limit 20
discord message search general deploy --limit 10
discord message send general hello world
discord message bulk-delete general --limit 20 --confirm
```
