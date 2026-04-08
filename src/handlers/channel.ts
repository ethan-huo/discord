import type { AppHandlers } from '../schema.ts'

import { CHANNEL_TYPES, CHANNEL_TYPE_NAMES, parseInteger } from '../domain.ts'
import { usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { resolveCategory, resolveChannel } from '../resolve.ts'
import { getRuntime } from '../runtime.ts'
import { actionResult, printStructured } from './helpers.ts'

export const channelHandlers: Pick<AppHandlers, 'channel'> = {
	channel: {
		list: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			let channels = await runtime.client.listChannels(runtime.guildId!)
			const limit = input.limit
				? parseInteger(input.limit, { label: 'limit', min: 1, max: 1000 })
				: undefined

			if (limit !== undefined) {
				channels = channels.slice(0, limit)
			}

			const categories = new Map(
				channels
					.filter((channel) => channel.type === 4)
					.map((channel) => [channel.id, channel.name]),
			)

			printStructured(
				channels
					.slice()
					.sort((left, right) => left.position - right.position)
					.map((channel) => ({
						id: channel.id,
						name: channel.name,
						type: channel.type,
						type_name: CHANNEL_TYPE_NAMES[channel.type] ?? null,
						parent_id: channel.parent_id ?? null,
						parent_name: channel.parent_id
							? (categories.get(channel.parent_id) ?? null)
							: null,
						position: channel.position,
						topic: channel.topic ?? null,
						nsfw: channel.nsfw ?? false,
					})),
				context,
			)
		}),

		create: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channelType = CHANNEL_TYPES[input.type]

			if (channelType === undefined) {
				throw usageError(`Unknown channel type "${input.type}".`, {
					details: { available: Object.keys(CHANNEL_TYPES) },
				})
			}

			let parentId: string | undefined
			if (input.category) {
				parentId = (
					await resolveCategory(
						runtime.client,
						runtime.guildId!,
						input.category,
					)
				).id
			}

			const draft = {
				name: input.name,
				type: channelType,
				parent_id: parentId,
				topic: input.topic,
			}

			if (input.dryRun) {
				printStructured(
					actionResult('create_channel', {
						dry_run: true,
						channel: draft,
					}),
					context,
				)
				return
			}

			const channel = await runtime.client.createChannel(
				runtime.guildId!,
				draft,
			)
			printStructured(
				actionResult('create_channel', {
					channel,
				}),
				context,
			)
		}),

		delete: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)

			if (!input.confirm) {
				throw usageError(
					`Refusing to delete channel ${channel.name} without confirmation.`,
					{
						hint: 'Re-run with --confirm after verifying the channel ID.',
						details: { channel_id: channel.id, required_flag: '--confirm' },
					},
				)
			}

			await runtime.client.deleteChannel(channel.id)
			printStructured(
				actionResult('delete_channel', {
					channel: {
						id: channel.id,
						name: channel.name,
					},
				}),
				context,
			)
		}),

		rename: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)

			if (input.dryRun) {
				printStructured(
					actionResult('rename_channel', {
						dry_run: true,
						channel: {
							id: channel.id,
							current_name: channel.name,
							new_name: input.newName,
						},
					}),
					context,
				)
				return
			}

			const updated = await runtime.client.modifyChannel(channel.id, {
				name: input.newName,
			})
			printStructured(
				actionResult('rename_channel', {
					channel: updated,
				}),
				context,
			)
		}),

		topic: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)
			const updated = await runtime.client.modifyChannel(channel.id, {
				topic: input.topic,
			})

			printStructured(
				actionResult('set_channel_topic', {
					channel: updated,
				}),
				context,
			)
		}),

		move: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)
			const changes: Record<string, unknown> = {}

			if (input.category) {
				changes.parent_id = (
					await resolveCategory(
						runtime.client,
						runtime.guildId!,
						input.category,
					)
				).id
			}
			if (input.position !== undefined) {
				changes.position = parseInteger(input.position, {
					label: 'position',
					min: 0,
				})
			}

			if (Object.keys(changes).length === 0) {
				throw usageError('Specify --category and/or --position.', {
					hint: 'This command only changes parent category and ordering.',
				})
			}

			const updated = await runtime.client.modifyChannel(channel.id, changes)
			printStructured(
				actionResult('move_channel', {
					changes,
					channel: updated,
				}),
				context,
			)
		}),

		clone: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)
			const source = await runtime.client.getChannel(channel.id)

			const cloned = await runtime.client.createChannel(runtime.guildId!, {
				name: input.name ?? source.name,
				type: source.type,
				parent_id: source.parent_id ?? undefined,
				topic: source.topic ?? undefined,
				nsfw: source.nsfw,
				rate_limit_per_user: source.rate_limit_per_user,
				bitrate: source.bitrate,
				user_limit: source.user_limit,
				permission_overwrites: source.permission_overwrites,
			})

			printStructured(
				actionResult('clone_channel', {
					source: {
						id: source.id,
						name: source.name,
					},
					channel: cloned,
				}),
				context,
			)
		}),

		slowmode: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const channel = await resolveChannel(
				runtime.client,
				runtime.guildId!,
				input.channel,
			)
			const seconds = parseInteger(input.seconds, {
				label: 'seconds',
				min: 0,
				max: 21600,
			})

			const updated = await runtime.client.modifyChannel(channel.id, {
				rate_limit_per_user: seconds,
			})

			printStructured(
				actionResult('set_channel_slowmode', {
					seconds,
					channel: updated,
				}),
				context,
			)
		}),
	},
}
