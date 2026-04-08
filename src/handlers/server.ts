import type { AppHandlers } from '../schema.ts'

import { updateFileConfig } from '../config.ts'
import { parseOptionalInteger } from '../domain.ts'
import { usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { fileToDataUrl } from '../io.ts'
import { getRuntime } from '../runtime.ts'
import { actionResult, printStructured } from './helpers.ts'

const VERIFICATION_LEVELS: Record<string, number> = {
	none: 0,
	low: 1,
	medium: 2,
	high: 3,
	very_high: 4,
}

const NOTIFICATION_LEVELS: Record<string, number> = {
	all_messages: 0,
	only_mentions: 1,
}

const CONTENT_FILTER_LEVELS: Record<string, number> = {
	disabled: 0,
	members_without_roles: 1,
	all_members: 2,
}

export const serverHandlers: Pick<AppHandlers, 'server'> = {
	server: {
		list: handled(async (options) => {
			const context = options.context
			const runtime = await getRuntime(context, { requireServer: false })
			const guilds = await runtime.client.listGuilds()

			printStructured(
				guilds.map((guild) => ({
					id: guild.id,
					name: guild.name,
					owner: guild.owner,
					permissions: guild.permissions,
				})),
				context,
			)
		}),

		select: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context, { requireServer: false })
			const guild = await runtime.client.getGuild(input.id)

			const storedConfig = await updateFileConfig(
				{ server: guild.id },
				context.config.path,
			)
			printStructured(
				actionResult('select_server', {
					server: {
						id: guild.id,
						name: guild.name,
					},
					config_path: context.config.path,
					stored_server: storedConfig.server ?? guild.id,
				}),
				context,
			)
		}),

		info: handled(async (options) => {
			const context = options.context
			const runtime = await getRuntime(context)
			const guild = await runtime.client.getGuild(runtime.guildId!)
			printStructured(guild, context)
		}),

		set: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const changes: Record<string, unknown> = {}

			if (input.name) changes.name = input.name
			if (input.description) changes.description = input.description
			if (input.verification)
				changes.verification_level = VERIFICATION_LEVELS[input.verification]
			if (input.notifications) {
				changes.default_message_notifications =
					NOTIFICATION_LEVELS[input.notifications]
			}
			if (input.contentFilter) {
				changes.explicit_content_filter =
					CONTENT_FILTER_LEVELS[input.contentFilter]
			}
			if (input.afkTimeout !== undefined) {
				changes.afk_timeout = parseOptionalInteger(input.afkTimeout, {
					label: 'afk-timeout',
					min: 60,
					max: 3600,
				})
			}
			if (input.systemChannel) changes.system_channel_id = input.systemChannel
			if (input.rulesChannel) changes.rules_channel_id = input.rulesChannel
			if (input.boostBar !== undefined) {
				changes.premium_progress_bar_enabled = input.boostBar
			}

			if (Object.keys(changes).length === 0) {
				throw usageError('Specify at least one setting to change.', {
					hint: 'Available fields: --name, --description, --verification, --notifications, --contentFilter, --afkTimeout, --systemChannel, --rulesChannel, --boostBar.',
				})
			}

			const guild = await runtime.client.modifyGuild(runtime.guildId!, changes)
			printStructured(
				actionResult('update_server', {
					changes,
					server: guild,
				}),
				context,
			)
		}),

		icon: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const icon = await fileToDataUrl(input.file)
			const guild = await runtime.client.modifyGuild(runtime.guildId!, { icon })

			printStructured(
				actionResult('update_server_icon', {
					server: {
						id: guild.id,
						name: guild.name,
						icon: guild.icon,
					},
				}),
				context,
			)
		}),
	},
}
