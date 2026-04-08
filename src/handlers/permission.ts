import type { AppHandlers } from '../schema.ts'

import {
	describePermissions,
	parsePermissionNames,
	PERMISSIONS,
} from '../domain.ts'
import { usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { resolveChannel, resolveRole } from '../resolve.ts'
import { getRuntime } from '../runtime.ts'
import { actionResult, printStructured } from './helpers.ts'

export const permissionHandlers: Pick<AppHandlers, 'permission'> = {
	permission: {
		view: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)
			const fullChannel = await runtime.client.getChannel(channel.id)
			const overwrites = fullChannel.permission_overwrites ?? []
			const roles = await runtime.client.listRoles(runtime.guildId!)

			printStructured(
				overwrites.map((overwrite) => ({
					id: overwrite.id,
					target_name:
						overwrite.type === 0
							? (roles.find((role) => role.id === overwrite.id)?.name ?? null)
							: null,
					target_kind: overwrite.type === 0 ? 'role' : 'member',
					allow: describePermissions(overwrite.allow),
					deny: describePermissions(overwrite.deny),
				})),
				context,
			)
		}),

		set: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)
			const role = await resolveRole(
				runtime.client,
				runtime.guildId!,
				input.role,
			)

			if (!input.allow && !input.deny) {
				throw usageError('Specify --allow and/or --deny.', {
					hint: 'Run "discord permission list" to see supported permission names.',
				})
			}

			const allow = input.allow ? parsePermissionNames(input.allow) : '0'
			const deny = input.deny ? parsePermissionNames(input.deny) : '0'

			if (input.dryRun) {
				printStructured(
					actionResult('set_permission', {
						dry_run: true,
						channel: {
							id: channel.id,
							name: channel.name,
						},
						role: {
							id: role.id,
							name: role.name,
						},
						allow,
						deny,
					}),
					context,
				)
				return
			}

			await runtime.client.editChannelPermission(channel.id, role.id, {
				allow,
				deny,
				type: 0,
			})

			printStructured(
				actionResult('set_permission', {
					channel: {
						id: channel.id,
						name: channel.name,
					},
					role: {
						id: role.id,
						name: role.name,
					},
					allow,
					deny,
				}),
				context,
			)
		}),

		lock: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)
			const deny = (
				PERMISSIONS.send_messages! |
				PERMISSIONS.send_messages_in_threads! |
				PERMISSIONS.create_public_threads! |
				PERMISSIONS.create_private_threads!
			).toString()

			if (input.dryRun) {
				printStructured(
					actionResult('lock_channel', {
						dry_run: true,
						channel: {
							id: channel.id,
							name: channel.name,
						},
						deny,
					}),
					context,
				)
				return
			}

			await runtime.client.editChannelPermission(channel.id, runtime.guildId!, {
				allow: '0',
				deny,
				type: 0,
			})

			printStructured(
				actionResult('lock_channel', {
					channel: {
						id: channel.id,
						name: channel.name,
					},
					deny,
				}),
				context,
			)
		}),

		unlock: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)

			await runtime.client.deleteChannelPermission(channel.id, runtime.guildId!)
			printStructured(
				actionResult('unlock_channel', {
					channel: {
						id: channel.id,
						name: channel.name,
					},
				}),
				context,
			)
		}),

		list: handled(async (options) => {
			const context = options.context
			const permissions = Object.entries(PERMISSIONS).map(([name, value]) => ({
				name,
				bit: value.toString(),
			}))

			printStructured(permissions, context)
		}),
	},
}
