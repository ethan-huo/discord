import type { AppHandlers } from '../schema.ts'

import { parseInteger } from '../domain.ts'
import { usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { resolveMember } from '../resolve.ts'
import { getRuntime } from '../runtime.ts'
import { actionResult, printStructured, requireMemberUser } from './helpers.ts'

export const memberHandlers: Pick<AppHandlers, 'member'> = {
	member: {
		list: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const limit = input.limit
				? parseInteger(input.limit, { label: 'limit', min: 1, max: 5000 })
				: 100
			const members = await runtime.client.listMembers(runtime.guildId!, limit)

			printStructured(
				members.map((member) => ({
					user_id: member.user?.id ?? null,
					username: member.user?.username ?? null,
					global_name: member.user?.global_name ?? null,
					nickname: member.nick ?? null,
					role_ids: member.roles,
					joined_at: member.joined_at,
				})),
				context,
			)
		}),

		info: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const member = await resolveMember(
				runtime.client,
				runtime.guildId!,
				input.user,
			)
			const roles = await runtime.client.listRoles(runtime.guildId!)
			const user = requireMemberUser(member)

			printStructured(
				{
					user,
					nickname: member.nick ?? null,
					joined_at: member.joined_at,
					roles: member.roles.map((roleId) => ({
						id: roleId,
						name: roles.find((role) => role.id === roleId)?.name ?? null,
					})),
				},
				context,
			)
		}),

		kick: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const member = await resolveMember(
				runtime.client,
				runtime.guildId!,
				input.user,
			)
			const user = requireMemberUser(member)

			if (!input.confirm) {
				throw usageError(
					`Refusing to kick ${user.username} without confirmation.`,
					{
						hint: 'Re-run with --confirm after verifying the target user.',
						details: { user_id: user.id, required_flag: '--confirm' },
					},
				)
			}

			await runtime.client.kickMember(runtime.guildId!, user.id, input.reason)
			printStructured(
				actionResult('kick_member', {
					user: {
						id: user.id,
						username: user.username,
					},
					reason: input.reason ?? null,
				}),
				context,
			)
		}),

		ban: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const member = await resolveMember(
				runtime.client,
				runtime.guildId!,
				input.user,
			)
			const user = requireMemberUser(member)

			if (!input.confirm) {
				throw usageError(
					`Refusing to ban ${user.username} without confirmation.`,
					{
						hint: 'Re-run with --confirm after verifying the target user.',
						details: { user_id: user.id, required_flag: '--confirm' },
					},
				)
			}

			await runtime.client.banMember(runtime.guildId!, user.id, input.reason)
			printStructured(
				actionResult('ban_member', {
					user: {
						id: user.id,
						username: user.username,
					},
					reason: input.reason ?? null,
				}),
				context,
			)
		}),

		nick: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const member = await resolveMember(
				runtime.client,
				runtime.guildId!,
				input.user,
			)
			const user = requireMemberUser(member)

			const currentUser = await runtime.client.getCurrentUser()
			// Discord rejects self-renames via /members/{user_id}; bots must use /members/@me/nick.
			if (user.id === currentUser.id) {
				await runtime.client.modifyOwnNickname(runtime.guildId!, input.nickname)
			} else {
				await runtime.client.modifyMember(runtime.guildId!, user.id, {
					nick: input.nickname,
				})
			}
			printStructured(
				actionResult('set_member_nick', {
					user: {
						id: user.id,
						username: user.username,
					},
					nickname: input.nickname,
				}),
				context,
			)
		}),
	},
}
