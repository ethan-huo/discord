import type { AppHandlers } from '../schema.ts'

import { parseInteger } from '../domain.ts'
import { usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { ensureFileExists, ensureMaxBytes, getTotalFileSize } from '../io.ts'
import { resolveEmoji } from '../resolve.ts'
import { getRuntime } from '../runtime.ts'
import { actionResult, printStructured } from './helpers.ts'

const MAX_EMOJI_BYTES = 256 * 1024

export const emojiHandlers: Pick<AppHandlers, 'emoji'> = {
	emoji: {
		list: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const limit = input.limit
				? parseInteger(input.limit, { label: 'limit', min: 1, max: 500 })
				: undefined
			const emojis = (await runtime.client.listEmojis(runtime.guildId!)).slice(
				0,
				limit ?? Number.POSITIVE_INFINITY,
			)

			printStructured(
				emojis.map((emoji) => ({
					id: emoji.id,
					name: emoji.name,
					animated: emoji.animated,
					available: emoji.available,
				})),
				context,
			)
		}),

		upload: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const filePath = await ensureFileExists(input.file)

			ensureMaxBytes(
				await getTotalFileSize([filePath]),
				MAX_EMOJI_BYTES,
				'Emoji file',
			)

			const emoji = await runtime.client.createEmoji(
				runtime.guildId!,
				input.name,
				filePath,
			)
			printStructured(
				actionResult('upload_emoji', {
					emoji,
				}),
				context,
			)
		}),

		delete: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const emoji = await resolveEmoji(
				runtime.client,
				runtime.guildId!,
				input.emoji,
			)

			if (!input.confirm) {
				throw usageError(
					`Refusing to delete emoji ${emoji.name} without confirmation.`,
					{
						hint: 'Re-run with --confirm after verifying the emoji ID.',
						details: { emoji_id: emoji.id, required_flag: '--confirm' },
					},
				)
			}

			await runtime.client.deleteEmoji(runtime.guildId!, emoji.id)
			printStructured(
				actionResult('delete_emoji', {
					emoji: {
						id: emoji.id,
						name: emoji.name,
					},
				}),
				context,
			)
		}),
	},
}
