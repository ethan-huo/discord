import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type {
	DiscordClient,
	Embed,
	Message,
	MessagePayload,
} from '../discord.ts'
import type { AppHandlers } from '../schema.ts'

import {
	asArray,
	ensureSafeFilename,
	isBulkDeletableTimestamp,
	parseEmbedFields,
	parseHexColor,
	parseInteger,
	unescapeCliText,
} from '../domain.ts'
import { CliError, usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { ensureFilesExist, ensureMaxBytes, getTotalFileSize } from '../io.ts'
import { resolveChannel } from '../resolve.ts'
import { getRuntime } from '../runtime.ts'
import { actionResult, printStructured } from './helpers.ts'

const MAX_MESSAGE_BYTES = 25 * 1024 * 1024

type DownloadedAttachment = {
	filename: string
	size: number
	output_path: string
	source_url: string
}

type FailedAttachment = {
	filename: string
	status: number
	source_url: string
}

const messageGroup: AppHandlers['message'] = {
	send: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const text =
			input.text && input.text.length > 0
				? unescapeCliText(input.text.join(' '))
				: undefined
		const files = asArray(input.file)

		if (!text && files.length === 0) {
			throw usageError('Provide message text or --file (or both).')
		}

		const payload = {
			...(text ? { content: text } : {}),
			...(input.reply
				? { message_reference: { message_id: input.reply } }
				: {}),
		}

		let message: Message
		if (files.length > 0) {
			const filePaths = await ensureFilesExist(files)
			ensureMaxBytes(
				await getTotalFileSize(filePaths),
				MAX_MESSAGE_BYTES,
				'Attachment payload',
			)
			message = await runtime.client.sendMessageWithFiles(
				channel.id,
				payload,
				filePaths,
			)
		} else {
			message = await runtime.client.sendMessage(channel.id, payload)
		}

		printStructured(
			actionResult('send_message', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message: summarizeMessage(message),
			}),
			context,
		)
	}),

	embed: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const localFiles: string[] = []

		const fields = parseEmbedFields(input.field)
		const embed: Embed = {
			...(input.title ? { title: unescapeCliText(input.title) } : {}),
			...(input.description
				? { description: unescapeCliText(input.description) }
				: {}),
			...(input.color ? { color: parseHexColor(input.color) } : {}),
			...(input.url ? { url: input.url } : {}),
			...(input.footer
				? { footer: { text: unescapeCliText(input.footer) } }
				: {}),
			...(input.author
				? { author: { name: unescapeCliText(input.author) } }
				: {}),
			...(fields ? { fields } : {}),
		}

		if (!embed.title && !embed.description) {
			throw usageError(
				'Provide at least --title or --description for the embed.',
			)
		}

		if (input.image) {
			try {
				const filePaths = await ensureFilesExist([input.image])
				const filePath = filePaths[0]
				if (!filePath) {
					throw new CliError(`File not found: ${input.image}`)
				}
				localFiles.push(filePath)
				embed.image = { url: `attachment://${ensureSafeFilename(input.image)}` }
			} catch {
				embed.image = { url: input.image }
			}
		}

		if (input.thumbnail) {
			try {
				const filePaths = await ensureFilesExist([input.thumbnail])
				const filePath = filePaths[0]
				if (!filePath) {
					throw new CliError(`File not found: ${input.thumbnail}`)
				}
				localFiles.push(filePath)
				embed.thumbnail = {
					url: `attachment://${ensureSafeFilename(input.thumbnail)}`,
				}
			} catch {
				embed.thumbnail = { url: input.thumbnail }
			}
		}

		const payload: MessagePayload = {
			...(input.content ? { content: unescapeCliText(input.content) } : {}),
			...(input.reply
				? { message_reference: { message_id: input.reply } }
				: {}),
			embeds: [embed],
		}

		let message: Message
		if (localFiles.length > 0) {
			ensureMaxBytes(
				await getTotalFileSize(localFiles),
				MAX_MESSAGE_BYTES,
				'Attachment payload',
			)
			message = await runtime.client.sendMessageWithFiles(
				channel.id,
				payload,
				localFiles,
			)
		} else {
			message = await runtime.client.sendMessage(channel.id, payload)
		}

		printStructured(
			actionResult('send_embed', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message: summarizeMessage(message),
			}),
			context,
		)
	}),

	read: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const limit = input.limit
			? parseInteger(input.limit, { label: 'limit', min: 1, max: 100 })
			: 10
		const messages = await runtime.client.getMessages(
			channel.id,
			limit,
			input.before,
		)

		printStructured(
			messages.map((message) => summarizeMessage(message)),
			context,
		)
	}),

	edit: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const message = await runtime.client.editMessage(
			channel.id,
			input.messageId,
			{
				content: unescapeCliText(input.text),
			},
		)

		printStructured(
			actionResult('edit_message', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message: summarizeMessage(message),
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
				`Refusing to delete message ${input.messageId} without confirmation.`,
				{
					hint: 'Re-run with --confirm after verifying the message ID.',
					details: { message_id: input.messageId, required_flag: '--confirm' },
				},
			)
		}

		await runtime.client.deleteMessage(channel.id, input.messageId)
		printStructured(
			actionResult('delete_message', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message_id: input.messageId,
			}),
			context,
		)
	}),

	'bulk-delete': handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const limit = input.limit
			? parseInteger(input.limit, { label: 'limit', min: 1, max: 100 })
			: 10

		if (!input.confirm) {
			throw usageError(
				`Refusing to bulk-delete ${limit} messages without confirmation.`,
				{
					hint: 'Re-run with --confirm after verifying the channel and limit.',
					details: {
						channel_id: channel.id,
						limit,
						required_flag: '--confirm',
					},
				},
			)
		}

		const messages = await runtime.client.getMessages(channel.id, limit)
		const recent = messages.filter((message) =>
			isBulkDeletableTimestamp(message.timestamp),
		)
		const old = messages.filter(
			(message) => !isBulkDeletableTimestamp(message.timestamp),
		)

		if (recent.length >= 2) {
			await runtime.client.bulkDeleteMessages(
				channel.id,
				recent.map((message) => message.id),
			)
		} else if (recent.length === 1) {
			await runtime.client.deleteMessage(channel.id, recent[0]!.id)
		}

		for (const message of old) {
			await runtime.client.deleteMessage(channel.id, message.id)
		}

		printStructured(
			actionResult('bulk_delete_messages', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				requested_limit: limit,
				deleted_count: messages.length,
				bulk_deleted_ids: recent.map((message) => message.id),
				individually_deleted_ids: old.map((message) => message.id),
			}),
			context,
		)
	}),

	search: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const limit = input.limit
			? parseInteger(input.limit, { label: 'limit', min: 1, max: 25 })
			: 25
		const response = await runtime.client.searchGuildMessages({
			guildId: runtime.guildId!,
			channelId: channel.id,
			content: input.keyword,
			limit,
		})

		const seen = new Set<string>()
		const matches = response.messages
			.flat()
			.filter((message) => {
				if (seen.has(message.id)) return false
				seen.add(message.id)
				return true
			})
			.map((message) => summarizeMessage(message))

		printStructured(
			{
				channel: {
					id: channel.id,
					name: channel.name,
				},
				keyword: input.keyword,
				matches,
			},
			context,
		)
	}),

	download: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const message = await runtime.client.getMessage(channel.id, input.messageId)
		const attachments = message.attachments ?? []

		if (attachments.length === 0) {
			throw new CliError('No attachments found on this message.', 1, {
				details: { message_id: input.messageId },
			})
		}

		const outputDir = resolve(input.output ?? '.')
		await mkdir(outputDir, { recursive: true })

		const usedNames = new Set<string>()
		const downloads: DownloadedAttachment[] = []
		const failures: FailedAttachment[] = []

		for (const attachment of attachments) {
			const response = await fetch(attachment.url)
			if (!response.ok) {
				failures.push({
					filename: attachment.filename,
					status: response.status,
					source_url: attachment.url,
				})
				continue
			}

			const safeName = uniqueFilename(
				ensureSafeFilename(attachment.filename),
				usedNames,
			)
			const outputPath = join(outputDir, safeName)
			await writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
			downloads.push({
				filename: safeName,
				size: attachment.size,
				output_path: outputPath,
				source_url: attachment.url,
			})
		}

		if (failures.length > 0) {
			throw new CliError('One or more attachments failed to download.', 1, {
				details: {
					channel_id: channel.id,
					message_id: input.messageId,
					output_dir: outputDir,
					downloads,
					failures,
				},
			})
		}

		printStructured(
			actionResult('download_attachments', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message_id: input.messageId,
				output_dir: outputDir,
				files: downloads,
			}),
			context,
		)
	}),

	react: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)

		await runtime.client.addReaction(channel.id, input.messageId, input.emoji)
		printStructured(
			actionResult('add_reaction', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message_id: input.messageId,
				emoji: input.emoji,
			}),
			context,
		)
	}),

	unreact: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)

		await runtime.client.removeReaction(
			channel.id,
			input.messageId,
			input.emoji,
		)
		printStructured(
			actionResult('remove_reaction', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message_id: input.messageId,
				emoji: input.emoji,
			}),
			context,
		)
	}),

	pin: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)

		await runtime.client.pinMessage(channel.id, input.messageId)
		printStructured(
			actionResult('pin_message', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message_id: input.messageId,
			}),
			context,
		)
	}),

	unpin: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)

		await runtime.client.unpinMessage(channel.id, input.messageId)
		printStructured(
			actionResult('unpin_message', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				message_id: input.messageId,
			}),
			context,
		)
	}),

	pins: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const pins = await listAllPins(runtime.client, channel.id)

		printStructured(
			{
				channel: {
					id: channel.id,
					name: channel.name,
				},
				pins: pins.map((message) => summarizeMessage(message)),
			},
			context,
		)
	}),

	thread: handled(async (options) => {
		const input = options.input
		const context = options.context
		const runtime = await getRuntime(context)
		const channel = await resolveChannel(
			runtime.client,
			runtime.guildId!,
			input.channel,
		)
		const thread = await runtime.client.createThread(
			channel.id,
			input.name,
			input.message,
		)

		printStructured(
			actionResult('create_thread', {
				channel: {
					id: channel.id,
					name: channel.name,
				},
				thread,
			}),
			context,
		)
	}),
}

export const messageHandlers: Pick<AppHandlers, 'message'> = {
	message: messageGroup,
}

async function listAllPins(
	client: DiscordClient,
	channelId: string,
): Promise<Message[]> {
	const messages: Message[] = []
	let before: string | undefined

	while (true) {
		const response = await client.getChannelPins(channelId, before)
		messages.push(...response.items.map((item) => item.message))
		if (!response.has_more || response.items.length === 0) {
			return messages
		}
		before = response.items.at(-1)?.pinned_at
	}
}

function summarizeMessage(message: Message): Record<string, unknown> {
	return {
		id: message.id,
		channel_id: message.channel_id,
		author: {
			id: message.author.id,
			username: message.author.username,
			global_name: message.author.global_name ?? null,
			bot: message.author.bot ?? false,
		},
		content: message.content,
		timestamp: message.timestamp,
		edited_timestamp: message.edited_timestamp ?? null,
		pinned: message.pinned,
		attachments: (message.attachments ?? []).map((attachment) => ({
			id: attachment.id,
			filename: attachment.filename,
			size: attachment.size,
			url: attachment.url,
			content_type: attachment.content_type ?? null,
		})),
		embeds: (message.embeds ?? []).map((embed) => ({
			title: embed.title ?? null,
			description: embed.description ?? null,
			url: embed.url ?? null,
		})),
	}
}

function uniqueFilename(filename: string, usedNames: Set<string>): string {
	if (!usedNames.has(filename)) {
		usedNames.add(filename)
		return filename
	}

	let index = 1
	while (usedNames.has(`${index}-${filename}`)) {
		index += 1
	}

	const deduped = `${index}-${filename}`
	usedNames.add(deduped)
	return deduped
}
