import { basename } from 'node:path'

import { notFoundError, usageError } from './errors.ts'

const TWO_WEEKS_IN_MS = 14 * 24 * 60 * 60 * 1000

export const PERMISSIONS: Record<string, bigint> = {
	administrator: 1n << 3n,
	create_invite: 1n << 0n,
	kick_members: 1n << 1n,
	ban_members: 1n << 2n,
	manage_channels: 1n << 4n,
	manage_server: 1n << 5n,
	add_reactions: 1n << 6n,
	view_audit_log: 1n << 7n,
	priority_speaker: 1n << 8n,
	video: 1n << 9n,
	view_channel: 1n << 10n,
	send_messages: 1n << 11n,
	manage_messages: 1n << 13n,
	embed_links: 1n << 14n,
	attach_files: 1n << 15n,
	read_message_history: 1n << 16n,
	mention_everyone: 1n << 17n,
	use_external_emojis: 1n << 18n,
	connect: 1n << 20n,
	speak: 1n << 21n,
	mute_members: 1n << 22n,
	deafen_members: 1n << 23n,
	move_members: 1n << 24n,
	use_voice_activity: 1n << 25n,
	change_nickname: 1n << 26n,
	manage_nicknames: 1n << 27n,
	manage_roles: 1n << 28n,
	manage_webhooks: 1n << 29n,
	manage_expressions: 1n << 30n,
	use_slash_commands: 1n << 31n,
	manage_events: 1n << 33n,
	manage_threads: 1n << 34n,
	create_public_threads: 1n << 35n,
	create_private_threads: 1n << 36n,
	send_messages_in_threads: 1n << 38n,
	moderate_members: 1n << 40n,
	create_expressions: 1n << 43n,
	create_events: 1n << 44n,
	pin_messages: 1n << 51n,
	bypass_slowmode: 1n << 52n,
}

export const CHANNEL_TYPES: Record<string, number> = {
	text: 0,
	voice: 2,
	category: 4,
	announcement: 5,
	stage: 13,
	forum: 15,
}

export const CHANNEL_TYPE_NAMES: Record<number, string> = Object.fromEntries(
	Object.entries(CHANNEL_TYPES).map(([name, value]) => [value, name]),
)

export const AUDIT_ACTIONS: Record<string, number> = {
	guild_update: 1,
	channel_create: 10,
	channel_update: 11,
	channel_delete: 12,
	member_kick: 20,
	member_prune: 21,
	member_ban_add: 22,
	member_ban_remove: 23,
	member_update: 24,
	member_role_update: 25,
	bot_add: 28,
	role_create: 30,
	role_update: 31,
	role_delete: 32,
	invite_create: 40,
	invite_delete: 42,
	webhook_create: 50,
	webhook_update: 51,
	webhook_delete: 52,
	emoji_create: 60,
	emoji_delete: 62,
	message_delete: 72,
	message_bulk_delete: 73,
	message_pin: 74,
	message_unpin: 75,
	integration_create: 80,
	integration_update: 81,
	integration_delete: 82,
	thread_create: 110,
	thread_update: 111,
	thread_delete: 112,
	automod_rule_create: 140,
	automod_rule_update: 141,
	automod_rule_delete: 142,
	automod_block_message: 143,
}

export const AUDIT_ACTION_NAMES: Record<number, string> = Object.fromEntries(
	Object.entries(AUDIT_ACTIONS).map(([name, value]) => [value, name]),
)

export function asArray<T>(value: T | T[] | undefined): T[] {
	if (value === undefined) return []
	return Array.isArray(value) ? value : [value]
}

export function parseHexColor(raw: string): number {
	const normalized = raw.replace(/^#/, '')
	if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
		throw usageError(
			`Invalid hex color "${raw}". Use six hexadecimal digits like "#5865F2".`,
		)
	}
	return Number.parseInt(normalized, 16)
}

export function parsePermissionNames(raw: string): string {
	let bits = 0n
	for (const permission of raw.split(',')) {
		const normalized = permission.trim().toLowerCase()
		const value = PERMISSIONS[normalized]
		if (value === undefined) {
			throw usageError(
				`Unknown permission "${normalized}". Available: ${Object.keys(PERMISSIONS).join(', ')}`,
			)
		}
		bits |= value
	}
	return bits.toString()
}

export function describePermissions(bitfield: string): string[] {
	const bits = BigInt(bitfield)
	if (bits === 0n) return []

	return Object.entries(PERMISSIONS)
		.filter(([, value]) => (bits & value) === value)
		.map(([name]) => name)
}

export function parseInteger(
	value: string | number,
	options: {
		label: string
		min?: number
		max?: number
	},
): number {
	const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
	if (!Number.isInteger(parsed)) {
		throw usageError(`${options.label} must be an integer.`)
	}
	if (options.min !== undefined && parsed < options.min) {
		throw usageError(`${options.label} must be >= ${options.min}.`)
	}
	if (options.max !== undefined && parsed > options.max) {
		throw usageError(`${options.label} must be <= ${options.max}.`)
	}
	return parsed
}

export function parseOptionalInteger(
	value: string | number | undefined,
	options: {
		label: string
		min?: number
		max?: number
	},
): number | undefined {
	if (value === undefined) return undefined
	return parseInteger(value, options)
}

export function unescapeCliText(raw: string): string {
	return raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

export function normalizeChannelLookup(raw: string): string {
	return raw.replace(/^#/, '').trim().toLowerCase()
}

export function normalizeRoleLookup(raw: string): string {
	return raw.replace(/^@/, '').trim().toLowerCase()
}

export function normalizeMemberLookup(raw: string): string {
	return raw.replace(/^@/, '').trim().toLowerCase()
}

export function ensureSafeFilename(raw: string): string {
	const normalized = raw.replaceAll('\\', '/')
	const safe = basename(normalized)
	if (!safe || safe === '.' || safe === '..') {
		throw notFoundError(`Unsafe attachment filename "${raw}".`)
	}
	return safe
}

export function isBulkDeletableTimestamp(timestamp: string): boolean {
	return Date.now() - Date.parse(timestamp) < TWO_WEEKS_IN_MS
}

export function parseEmbedFields(values: string | string[] | undefined):
	| Array<{
			name: string
			value: string
			inline?: boolean
	  }>
	| undefined {
	const items = asArray(values)
	if (items.length === 0) return undefined

	return items.map((item) => {
		const [name, value = '', inline] = item.split('|')
		if (!name) {
			throw usageError(
				'Embed field must use "Name|Value" or "Name|Value|inline".',
			)
		}
		return {
			name: unescapeCliText(name),
			value: unescapeCliText(value),
			inline: inline === 'inline' ? true : undefined,
		}
	})
}

export function resolveAttachmentReference(raw: string): string {
	return ensureSafeFilename(raw)
}
