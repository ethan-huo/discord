import type { InferHandlers } from 'argc'

import { toStandardJsonSchema } from '@valibot/to-json-schema'
import { c, group } from 'argc'
import * as v from 'valibot'

import type { AppContext } from './runtime.ts'

const s = toStandardJsonSchema

const stringList = v.optional(v.union([v.string(), v.array(v.string())]))
const optionalBoolean = v.optional(v.boolean())
const optionalNumberish = v.optional(v.union([v.string(), v.number()]))

const permissionChildren = {
	view: c
		.meta({
			description: 'Inspect channel permission overwrites.',
			examples: ['discord permission view general'],
		})
		.args('channel')
		.input(s(v.object({ channel: v.string() }))),
	set: c
		.meta({
			description: 'Set a role overwrite on a channel.',
			examples: [
				'discord permission set general moderators --allow send_messages,embed_links',
			],
		})
		.args('channel', 'role')
		.input(
			s(
				v.object({
					channel: v.string(),
					role: v.string(),
					allow: v.optional(v.string()),
					deny: v.optional(v.string()),
					dryRun: optionalBoolean,
				}),
			),
		),
	lock: c
		.meta({ description: 'Make a channel read-only for @everyone.' })
		.args('channel')
		.input(
			s(
				v.object({
					channel: v.string(),
					dryRun: optionalBoolean,
				}),
			),
		),
	unlock: c
		.meta({ description: 'Remove the @everyone read-only overwrite.' })
		.args('channel')
		.input(s(v.object({ channel: v.string() }))),
	list: c.meta({ description: 'List supported Discord permission names.' }),
}

const messageChildren = {
	send: c
		.meta({
			description: 'Send a message to a channel.',
			examples: ['discord message send general hello world'],
		})
		.args('channel', 'text...')
		.input(
			s(
				v.object({
					channel: v.string(),
					text: v.optional(v.array(v.string())),
					reply: v.optional(v.string()),
					file: stringList,
				}),
			),
		),
	embed: c
		.meta({ description: 'Send an embed to a channel.' })
		.args('channel')
		.input(
			s(
				v.object({
					channel: v.string(),
					title: v.optional(v.string()),
					description: v.optional(v.string()),
					color: v.optional(v.string()),
					url: v.optional(v.string()),
					image: v.optional(v.string()),
					thumbnail: v.optional(v.string()),
					footer: v.optional(v.string()),
					author: v.optional(v.string()),
					field: stringList,
					content: v.optional(v.string()),
					reply: v.optional(v.string()),
				}),
			),
		),
	read: c
		.meta({ description: 'Read recent channel messages.' })
		.args('channel')
		.input(
			s(
				v.object({
					channel: v.string(),
					limit: optionalNumberish,
					before: v.optional(v.string()),
				}),
			),
		),
	edit: c
		.meta({ description: 'Edit a bot-authored message.' })
		.args('channel', 'messageId', 'text')
		.input(
			s(
				v.object({
					channel: v.string(),
					messageId: v.string(),
					text: v.string(),
				}),
			),
		),
	delete: c
		.meta({ description: 'Delete a message.' })
		.args('channel', 'messageId')
		.input(
			s(
				v.object({
					channel: v.string(),
					messageId: v.string(),
					confirm: optionalBoolean,
				}),
			),
		),
	'bulk-delete': c
		.meta({ description: 'Delete multiple recent messages.' })
		.args('channel')
		.input(
			s(
				v.object({
					channel: v.string(),
					limit: optionalNumberish,
					confirm: optionalBoolean,
				}),
			),
		),
	search: c
		.meta({
			description: 'Search guild-indexed messages within a channel.',
			examples: ['discord message search general deploy --limit 10'],
		})
		.args('channel', 'keyword')
		.input(
			s(
				v.object({
					channel: v.string(),
					keyword: v.string(),
					limit: optionalNumberish,
				}),
			),
		),
	download: c
		.meta({ description: 'Download attachments from a message.' })
		.args('channel', 'messageId')
		.input(
			s(
				v.object({
					channel: v.string(),
					messageId: v.string(),
					output: v.optional(v.string()),
				}),
			),
		),
	react: c
		.meta({ description: 'Add a reaction to a message.' })
		.args('channel', 'messageId', 'emoji')
		.input(
			s(
				v.object({
					channel: v.string(),
					messageId: v.string(),
					emoji: v.string(),
				}),
			),
		),
	unreact: c
		.meta({ description: 'Remove the bot reaction from a message.' })
		.args('channel', 'messageId', 'emoji')
		.input(
			s(
				v.object({
					channel: v.string(),
					messageId: v.string(),
					emoji: v.string(),
				}),
			),
		),
	pin: c
		.meta({ description: 'Pin a message.' })
		.args('channel', 'messageId')
		.input(
			s(
				v.object({
					channel: v.string(),
					messageId: v.string(),
				}),
			),
		),
	unpin: c
		.meta({ description: 'Unpin a message.' })
		.args('channel', 'messageId')
		.input(
			s(
				v.object({
					channel: v.string(),
					messageId: v.string(),
				}),
			),
		),
	pins: c
		.meta({ description: 'List pinned messages in a channel.' })
		.args('channel')
		.input(s(v.object({ channel: v.string() }))),
	thread: c
		.meta({ description: 'Create a thread from a message or channel.' })
		.args('channel', 'name')
		.input(
			s(
				v.object({
					channel: v.string(),
					name: v.string(),
					message: v.optional(v.string()),
				}),
			),
		),
}

export const globalsSchema = s(
	v.object({
		format: v.optional(v.picklist(['toon', 'json'])),
		server: v.optional(v.string()),
	}),
)

export const schema = {
	server: group(
		{ description: 'Manage and inspect servers.' },
		{
			list: c.meta({ description: 'List all servers the bot can access.' }),
			select: c
				.meta({ description: 'Persist the default server selection.' })
				.args('id')
				.input(s(v.object({ id: v.string() }))),
			info: c.meta({ description: 'Show the selected server details.' }),
			set: c.meta({ description: 'Modify server settings.' }).input(
				s(
					v.object({
						name: v.optional(v.string()),
						description: v.optional(v.string()),
						verification: v.optional(
							v.picklist(['none', 'low', 'medium', 'high', 'very_high']),
						),
						notifications: v.optional(
							v.picklist(['all_messages', 'only_mentions']),
						),
						contentFilter: v.optional(
							v.picklist(['disabled', 'members_without_roles', 'all_members']),
						),
						afkTimeout: optionalNumberish,
						systemChannel: v.optional(v.string()),
						rulesChannel: v.optional(v.string()),
						boostBar: optionalBoolean,
					}),
				),
			),
			icon: c
				.meta({ description: 'Change the server icon.' })
				.args('file')
				.input(s(v.object({ file: v.string() }))),
		},
	),
	invite: group(
		{ description: 'Manage server invites.' },
		{
			list: c.meta({ description: 'List active invites.' }),
			create: c
				.meta({ description: 'Create an invite link.' })
				.args('channel')
				.input(
					s(
						v.object({
							channel: v.string(),
							maxAge: optionalNumberish,
							maxUses: optionalNumberish,
							temporary: optionalBoolean,
						}),
					),
				),
			delete: c
				.meta({ description: 'Delete an invite.' })
				.args('code')
				.input(
					s(
						v.object({
							code: v.string(),
							confirm: optionalBoolean,
						}),
					),
				),
		},
	),
	channel: group(
		{ description: 'Manage server channels.' },
		{
			list: c
				.meta({ description: 'List channels in the selected server.' })
				.input(
					s(
						v.object({
							limit: optionalNumberish,
						}),
					),
				),
			create: c
				.meta({
					description: 'Create a new channel.',
					examples: [
						'discord channel create release-notes --type announcement',
					],
				})
				.args('name')
				.input(
					s(
						v.object({
							name: v.string(),
							type: v.optional(
								v.picklist([
									'text',
									'voice',
									'category',
									'announcement',
									'stage',
									'forum',
								]),
								'text',
							),
							category: v.optional(v.string()),
							topic: v.optional(v.string()),
							dryRun: optionalBoolean,
						}),
					),
				),
			delete: c
				.meta({ description: 'Delete a channel.' })
				.args('channel')
				.input(
					s(
						v.object({
							channel: v.string(),
							confirm: optionalBoolean,
						}),
					),
				),
			rename: c
				.meta({ description: 'Rename a channel.' })
				.args('channel', 'newName')
				.input(
					s(
						v.object({
							channel: v.string(),
							newName: v.string(),
							dryRun: optionalBoolean,
						}),
					),
				),
			topic: c
				.meta({ description: 'Set a text channel topic.' })
				.args('channel', 'topic')
				.input(
					s(
						v.object({
							channel: v.string(),
							topic: v.string(),
						}),
					),
				),
			move: c
				.meta({
					description: 'Move a channel to another category or position.',
				})
				.args('channel')
				.input(
					s(
						v.object({
							channel: v.string(),
							category: v.optional(v.string()),
							position: optionalNumberish,
						}),
					),
				),
			clone: c
				.meta({ description: 'Clone a channel with matching settings.' })
				.args('channel')
				.input(
					s(
						v.object({
							channel: v.string(),
							name: v.optional(v.string()),
						}),
					),
				),
			slowmode: c
				.meta({ description: 'Set a slowmode delay for a channel.' })
				.args('channel', 'seconds')
				.input(
					s(
						v.object({
							channel: v.string(),
							seconds: v.union([v.string(), v.number()]),
						}),
					),
				),
		},
	),
	role: group(
		{ description: 'Manage server roles.' },
		{
			list: c
				.meta({ description: 'List roles in descending position order.' })
				.input(
					s(
						v.object({
							limit: optionalNumberish,
						}),
					),
				),
			create: c
				.meta({ description: 'Create a new role.' })
				.args('name')
				.input(
					s(
						v.object({
							name: v.string(),
							color: v.optional(v.string()),
							permissions: v.optional(v.string()),
							mentionable: optionalBoolean,
							hoist: optionalBoolean,
							dryRun: optionalBoolean,
						}),
					),
				),
			edit: c
				.meta({ description: 'Edit an existing role.' })
				.args('role')
				.input(
					s(
						v.object({
							role: v.string(),
							name: v.optional(v.string()),
							color: v.optional(v.string()),
							permissions: v.optional(v.string()),
							mentionable: optionalBoolean,
							hoist: optionalBoolean,
							dryRun: optionalBoolean,
						}),
					),
				),
			delete: c
				.meta({ description: 'Delete a role.' })
				.args('role')
				.input(
					s(
						v.object({
							role: v.string(),
							confirm: optionalBoolean,
						}),
					),
				),
			assign: c
				.meta({ description: 'Assign a role to a member.' })
				.args('role', 'user')
				.input(
					s(
						v.object({
							role: v.string(),
							user: v.string(),
						}),
					),
				),
			remove: c
				.meta({ description: 'Remove a role from a member.' })
				.args('role', 'user')
				.input(
					s(
						v.object({
							role: v.string(),
							user: v.string(),
						}),
					),
				),
		},
	),
	member: group(
		{ description: 'Manage server members.' },
		{
			list: c
				.meta({ description: 'List members in the selected server.' })
				.input(
					s(
						v.object({
							limit: optionalNumberish,
						}),
					),
				),
			info: c
				.meta({ description: 'Show member details.' })
				.args('user')
				.input(s(v.object({ user: v.string() }))),
			kick: c
				.meta({ description: 'Kick a member from the server.' })
				.args('user')
				.input(
					s(
						v.object({
							user: v.string(),
							reason: v.optional(v.string()),
							confirm: optionalBoolean,
						}),
					),
				),
			ban: c
				.meta({ description: 'Ban a member from the server.' })
				.args('user')
				.input(
					s(
						v.object({
							user: v.string(),
							reason: v.optional(v.string()),
							confirm: optionalBoolean,
						}),
					),
				),
			nick: c
				.meta({ description: 'Change a member nickname.' })
				.args('user', 'nickname')
				.input(
					s(
						v.object({
							user: v.string(),
							nickname: v.string(),
						}),
					),
				),
		},
	),
	permission: group(
		{ description: 'Manage channel permission overwrites.' },
		permissionChildren,
	),
	message: group(
		{ description: 'Send, read, and manage messages.' },
		messageChildren,
	),
	emoji: group(
		{ description: 'Manage server emojis.' },
		{
			list: c.meta({ description: 'List custom emojis.' }).input(
				s(
					v.object({
						limit: optionalNumberish,
					}),
				),
			),
			upload: c
				.meta({ description: 'Upload a custom emoji.' })
				.args('name', 'file')
				.input(
					s(
						v.object({
							name: v.string(),
							file: v.string(),
						}),
					),
				),
			delete: c
				.meta({ description: 'Delete a custom emoji.' })
				.args('emoji')
				.input(
					s(
						v.object({
							emoji: v.string(),
							confirm: optionalBoolean,
						}),
					),
				),
		},
	),
	audit: group(
		{ description: 'Inspect the server audit log.' },
		{
			log: c.meta({ description: 'List recent audit log entries.' }).input(
				s(
					v.object({
						limit: optionalNumberish,
						type: v.optional(v.string()),
						user: v.optional(v.string()),
					}),
				),
			),
			types: c.meta({ description: 'List supported audit log action types.' }),
		},
	),
}

export type AppHandlers = InferHandlers<typeof schema, AppContext>
