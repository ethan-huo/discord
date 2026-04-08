import type { AppHandlers } from '../schema.ts'

import { parseOptionalInteger } from '../domain.ts'
import { usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { resolveChannel } from '../resolve.ts'
import { getRuntime } from '../runtime.ts'
import { actionResult, printStructured } from './helpers.ts'

export const inviteHandlers: Pick<AppHandlers, 'invite'> = {
	invite: {
		list: handled(async (options) => {
			const context = options.context
			const runtime = await getRuntime(context)
			const invites = await runtime.client.getGuildInvites(runtime.guildId!)

			printStructured(
				invites.map((invite) => ({
					code: invite.code,
					channel_id: invite.channel?.id ?? null,
					channel_name: invite.channel?.name ?? null,
					inviter_id: invite.inviter?.id ?? null,
					inviter_username: invite.inviter?.username ?? null,
					uses: invite.uses,
					max_uses: invite.max_uses,
					max_age: invite.max_age,
					temporary: invite.temporary,
					created_at: invite.created_at,
				})),
				context,
			)
		}),

		create: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)

			const invite = await runtime.client.createChannelInvite(channel.id, {
				unique: true,
				max_age: parseOptionalInteger(input.maxAge, {
					label: 'max-age',
					min: 0,
					max: 604800,
				}),
				max_uses: parseOptionalInteger(input.maxUses, {
					label: 'max-uses',
					min: 0,
					max: 100,
				}),
				temporary: input.temporary === true ? true : undefined,
			})

			printStructured(
				actionResult('create_invite', {
					channel: {
						id: channel.id,
						name: channel.name,
					},
					invite,
					url: `https://discord.gg/${invite.code}`,
				}),
				context,
			)
		}),

		delete: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context, { requireServer: false })

			if (!input.confirm) {
				throw usageError(
					`Refusing to delete invite ${input.code} without confirmation.`,
					{
						hint: 'Re-run with --confirm after verifying the invite code.',
						details: { code: input.code, required_flag: '--confirm' },
					},
				)
			}

			await runtime.client.deleteInvite(input.code)
			printStructured(
				actionResult('delete_invite', {
					code: input.code,
				}),
				context,
			)
		}),
	},
}
