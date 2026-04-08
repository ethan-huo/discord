import type { OutputFormat } from './output.ts'

import {
	resolveConfigContext,
	type AppGlobals,
	type ConfigContext,
	type ResolvedGlobalConfig,
} from './config.ts'
import { DiscordClient } from './discord.ts'
import { CliError } from './errors.ts'

export type AppContext = {
	config: ConfigContext
	client?: DiscordClient
}

export type AppRuntime = {
	client: DiscordClient
	guildId?: string
	format: OutputFormat
	globalConfig: ResolvedGlobalConfig
}

export async function createContext(globals: AppGlobals): Promise<AppContext> {
	const config = await resolveConfigContext(globals)

	return {
		config,
		client: config.resolved.token
			? new DiscordClient(config.resolved.token)
			: undefined,
	}
}

export async function getRuntime(
	context: AppContext,
	options?: { requireServer?: boolean },
): Promise<AppRuntime> {
	if (!context.client) {
		throw new CliError('Missing Discord token.', 1, {
			hint: 'Set DISCORD_TOKEN or provide a token in ~/.config/discord/config.json.',
		})
	}

	const guildId = context.config.resolved.server
	if (options?.requireServer !== false && !guildId) {
		throw new CliError(
			'No server selected. Run "discord server select <id>" or pass --server <id>.',
			1,
			{
				hint: 'Use "discord server list" to discover server IDs before selecting one.',
			},
		)
	}

	return {
		client: context.client,
		guildId,
		format: context.config.resolved.format,
		globalConfig: context.config.resolved,
	}
}
