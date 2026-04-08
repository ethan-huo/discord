import type { AppHandlers } from '../schema.ts'

import { parseHexColor, parseInteger, parsePermissionNames } from '../domain.ts'
import { usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { resolveMember, resolveRole } from '../resolve.ts'
import { getRuntime } from '../runtime.ts'
import { actionResult, printStructured, requireMemberUser } from './helpers.ts'

export const roleHandlers: Pick<AppHandlers, 'role'> = {
	role: {
		list: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const limit = input.limit
				? parseInteger(input.limit, { label: 'limit', min: 1, max: 1000 })
				: undefined
			const roles = (await runtime.client.listRoles(runtime.guildId!))
				.sort((left, right) => right.position - left.position)
				.slice(0, limit ?? Number.POSITIVE_INFINITY)

			printStructured(
				roles.map((role) => ({
					id: role.id,
					name: role.name,
					color: role.color,
					position: role.position,
					permissions: role.permissions,
					managed: role.managed,
					mentionable: role.mentionable,
				})),
				context,
			)
		}),

		create: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const data: Record<string, unknown> = { name: input.name }

			if (input.color) data.color = parseHexColor(input.color)
			if (input.permissions)
				data.permissions = parsePermissionNames(input.permissions)
			if (input.mentionable !== undefined) data.mentionable = input.mentionable
			if (input.hoist !== undefined) data.hoist = input.hoist

			if (input.dryRun) {
				printStructured(
					actionResult('create_role', {
						dry_run: true,
						role: data,
					}),
					context,
				)
				return
			}

			const role = await runtime.client.createRole(runtime.guildId!, data)
			printStructured(
				actionResult('create_role', {
					role,
				}),
				context,
			)
		}),

		edit: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const role = await resolveRole(
				runtime.client,
				runtime.guildId!,
				input.role,
			)
			const changes: Record<string, unknown> = {}

			if (input.name) changes.name = input.name
			if (input.color) changes.color = parseHexColor(input.color)
			if (input.permissions)
				changes.permissions = parsePermissionNames(input.permissions)
			if (input.mentionable !== undefined)
				changes.mentionable = input.mentionable
			if (input.hoist !== undefined) changes.hoist = input.hoist

			if (Object.keys(changes).length === 0) {
				throw usageError('Specify at least one role field to change.', {
					hint: 'Use --name, --color, --permissions, --mentionable, or --hoist.',
				})
			}

			if (input.dryRun) {
				printStructured(
					actionResult('edit_role', {
						dry_run: true,
						role: {
							id: role.id,
							name: role.name,
						},
						changes,
					}),
					context,
				)
				return
			}

			const updated = await runtime.client.modifyRole(
				runtime.guildId!,
				role.id,
				changes,
			)
			printStructured(
				actionResult('edit_role', {
					changes,
					role: updated,
				}),
				context,
			)
		}),

		delete: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const role = await resolveRole(
				runtime.client,
				runtime.guildId!,
				input.role,
			)

			if (!input.confirm) {
				throw usageError(
					`Refusing to delete role ${role.name} without confirmation.`,
					{
						hint: 'Re-run with --confirm after verifying the role ID.',
						details: { role_id: role.id, required_flag: '--confirm' },
					},
				)
			}

			await runtime.client.deleteRole(runtime.guildId!, role.id)
			printStructured(
				actionResult('delete_role', {
					role: {
						id: role.id,
						name: role.name,
					},
				}),
				context,
			)
		}),

		assign: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const role = await resolveRole(
				runtime.client,
				runtime.guildId!,
				input.role,
			)
			const member = await resolveMember(
				runtime.client,
				runtime.guildId!,
				input.user,
			)
			const user = requireMemberUser(member)

			await runtime.client.addRoleToMember(runtime.guildId!, user.id, role.id)
			printStructured(
				actionResult('assign_role', {
					role: {
						id: role.id,
						name: role.name,
					},
					user: {
						id: user.id,
						username: user.username,
					},
				}),
				context,
			)
		}),

		remove: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const role = await resolveRole(
				runtime.client,
				runtime.guildId!,
				input.role,
			)
			const member = await resolveMember(
				runtime.client,
				runtime.guildId!,
				input.user,
			)
			const user = requireMemberUser(member)

			await runtime.client.removeRoleFromMember(
				runtime.guildId!,
				user.id,
				role.id,
			)
			printStructured(
				actionResult('remove_role', {
					role: {
						id: role.id,
						name: role.name,
					},
					user: {
						id: user.id,
						username: user.username,
					},
				}),
				context,
			)
		}),
	},
}
