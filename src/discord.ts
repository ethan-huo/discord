import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { CliError, forbiddenError, notFoundError } from './errors.ts'

const BASE_URL = 'https://discord.com/api/v10'

type RequestOptions = {
	body?: unknown
	headers?: Record<string, string>
	reason?: string
}

type SearchIndexPending = {
	message?: string
	retry_after?: number
}

export class DiscordClient {
	constructor(private readonly token: string) {}

	private buildHeaders(options?: RequestOptions): Headers {
		const headers = new Headers(options?.headers)
		headers.set('Authorization', `Bot ${this.token}`)

		if (options?.reason) {
			// Discord requires the reason to travel in the audit-log header, not as a body field.
			headers.set('X-Audit-Log-Reason', encodeURIComponent(options.reason))
		}

		if (options?.body !== undefined && !(options.body instanceof FormData)) {
			headers.set('Content-Type', 'application/json')
		}

		return headers
	}

	private async request<T>(
		method: string,
		path: string,
		options?: RequestOptions,
	): Promise<T> {
		const body =
			options?.body === undefined
				? undefined
				: options.body instanceof FormData
					? options.body
					: JSON.stringify(options.body)

		const response = await fetch(`${BASE_URL}${path}`, {
			method,
			headers: this.buildHeaders(options),
			body,
		})

		if (response.status === 204) {
			return null as T
		}

		if (response.status === 202) {
			const pending = (await response.json()) as SearchIndexPending
			throw new CliError(
				`Search index not ready. Retry after ${pending.retry_after ?? 0}s.`,
				1,
			)
		}

		if (response.status === 429) {
			const pending = (await response.json()) as SearchIndexPending
			throw new CliError(
				`Rate limited. Retry after ${pending.retry_after ?? '?'}s.`,
				1,
			)
		}

		if (response.status === 403) {
			throw forbiddenError('403 Forbidden, missing permissions.')
		}

		if (response.status === 404) {
			throw notFoundError('404 Not found.')
		}

		if (response.status >= 400) {
			const text = await response.text()
			throw new CliError(
				`Discord API error ${response.status}: ${text.slice(0, 200)}`,
				1,
			)
		}

		const contentType = response.headers.get('content-type') ?? ''
		if (contentType.includes('application/json')) {
			return (await response.json()) as T
		}

		return (await response.text()) as T
	}

	async listGuilds(): Promise<Guild[]> {
		return this.request<Guild[]>('GET', '/users/@me/guilds')
	}

	async getCurrentUser(): Promise<UserSummary> {
		return this.request<UserSummary>('GET', '/users/@me')
	}

	async getGuild(guildId: string): Promise<GuildFull> {
		return this.request<GuildFull>('GET', `/guilds/${guildId}?with_counts=true`)
	}

	async modifyGuild(
		guildId: string,
		data: Record<string, unknown>,
	): Promise<GuildFull> {
		return this.request<GuildFull>('PATCH', `/guilds/${guildId}`, {
			body: data,
		})
	}

	async listChannels(guildId: string): Promise<Channel[]> {
		return this.request<Channel[]>('GET', `/guilds/${guildId}/channels`)
	}

	async getChannel(channelId: string): Promise<Channel> {
		return this.request<Channel>('GET', `/channels/${channelId}`)
	}

	async createChannel(
		guildId: string,
		data: {
			name: string
			type?: number
			parent_id?: string
			topic?: string
			nsfw?: boolean
			rate_limit_per_user?: number
			bitrate?: number
			user_limit?: number
			permission_overwrites?: PermissionOverwrite[]
		},
	): Promise<Channel> {
		return this.request<Channel>('POST', `/guilds/${guildId}/channels`, {
			body: data,
		})
	}

	async modifyChannel(
		channelId: string,
		data: Record<string, unknown>,
	): Promise<Channel> {
		return this.request<Channel>('PATCH', `/channels/${channelId}`, {
			body: data,
		})
	}

	async deleteChannel(channelId: string): Promise<void> {
		await this.request<void>('DELETE', `/channels/${channelId}`)
	}

	async editChannelPermission(
		channelId: string,
		overwriteId: string,
		data: { allow?: string; deny?: string; type: number },
	): Promise<void> {
		await this.request<void>(
			'PUT',
			`/channels/${channelId}/permissions/${overwriteId}`,
			{
				body: data,
			},
		)
	}

	async deleteChannelPermission(
		channelId: string,
		overwriteId: string,
	): Promise<void> {
		await this.request<void>(
			'DELETE',
			`/channels/${channelId}/permissions/${overwriteId}`,
		)
	}

	async listRoles(guildId: string): Promise<Role[]> {
		return this.request<Role[]>('GET', `/guilds/${guildId}/roles`)
	}

	async createRole(
		guildId: string,
		data: Record<string, unknown>,
	): Promise<Role> {
		return this.request<Role>('POST', `/guilds/${guildId}/roles`, {
			body: data,
		})
	}

	async modifyRole(
		guildId: string,
		roleId: string,
		data: Record<string, unknown>,
	): Promise<Role> {
		return this.request<Role>('PATCH', `/guilds/${guildId}/roles/${roleId}`, {
			body: data,
		})
	}

	async deleteRole(guildId: string, roleId: string): Promise<void> {
		await this.request<void>('DELETE', `/guilds/${guildId}/roles/${roleId}`)
	}

	async addRoleToMember(
		guildId: string,
		userId: string,
		roleId: string,
	): Promise<void> {
		await this.request<void>(
			'PUT',
			`/guilds/${guildId}/members/${userId}/roles/${roleId}`,
		)
	}

	async removeRoleFromMember(
		guildId: string,
		userId: string,
		roleId: string,
	): Promise<void> {
		await this.request<void>(
			'DELETE',
			`/guilds/${guildId}/members/${userId}/roles/${roleId}`,
		)
	}

	async listMembers(guildId: string, limit = 100): Promise<Member[]> {
		const members: Member[] = []
		let after: string | undefined

		while (members.length < limit) {
			const pageSize = Math.min(1000, limit - members.length)
			const params = new URLSearchParams({ limit: String(pageSize) })
			if (after) params.set('after', after)

			const page = await this.request<Member[]>(
				'GET',
				`/guilds/${guildId}/members?${params.toString()}`,
			)
			members.push(...page)

			const lastMember = page.at(-1)
			if (!lastMember?.user?.id || page.length < pageSize) {
				break
			}
			after = lastMember.user.id
		}

		return members
	}

	async searchMembers(
		guildId: string,
		query: string,
		limit = 20,
	): Promise<Member[]> {
		const params = new URLSearchParams({
			query,
			limit: String(Math.min(limit, 1000)),
		})
		return this.request<Member[]>(
			'GET',
			`/guilds/${guildId}/members/search?${params.toString()}`,
		)
	}

	async getMember(guildId: string, userId: string): Promise<Member> {
		return this.request<Member>('GET', `/guilds/${guildId}/members/${userId}`)
	}

	async kickMember(
		guildId: string,
		userId: string,
		reason?: string,
	): Promise<void> {
		await this.request<void>('DELETE', `/guilds/${guildId}/members/${userId}`, {
			reason,
		})
	}

	async banMember(
		guildId: string,
		userId: string,
		reason?: string,
	): Promise<void> {
		await this.request<void>('PUT', `/guilds/${guildId}/bans/${userId}`, {
			reason,
		})
	}

	async modifyMember(
		guildId: string,
		userId: string,
		data: Record<string, unknown>,
		reason?: string,
	): Promise<Member> {
		return this.request<Member>(
			'PATCH',
			`/guilds/${guildId}/members/${userId}`,
			{
				body: data,
				reason,
			},
		)
	}

	async modifyOwnNickname(guildId: string, nick: string): Promise<void> {
		await this.request<void>('PATCH', `/guilds/${guildId}/members/@me/nick`, {
			body: { nick },
		})
	}

	async getGuildInvites(guildId: string): Promise<Invite[]> {
		return this.request<Invite[]>('GET', `/guilds/${guildId}/invites`)
	}

	async createChannelInvite(
		channelId: string,
		data: {
			max_age?: number
			max_uses?: number
			temporary?: boolean
			unique?: boolean
		},
	): Promise<Invite> {
		return this.request<Invite>('POST', `/channels/${channelId}/invites`, {
			body: data,
		})
	}

	async deleteInvite(code: string): Promise<void> {
		await this.request<void>('DELETE', `/invites/${code}`)
	}

	async getAuditLog(
		guildId: string,
		options?: {
			user_id?: string
			action_type?: number
			limit?: number
			before?: string
		},
	): Promise<AuditLog> {
		const params = new URLSearchParams()
		if (options?.user_id) params.set('user_id', options.user_id)
		if (options?.action_type !== undefined)
			params.set('action_type', String(options.action_type))
		if (options?.limit !== undefined)
			params.set('limit', String(Math.min(options.limit, 100)))
		if (options?.before) params.set('before', options.before)
		return this.request<AuditLog>(
			'GET',
			`/guilds/${guildId}/audit-logs${params.size > 0 ? `?${params.toString()}` : ''}`,
		)
	}

	async sendMessage(channelId: string, data: MessagePayload): Promise<Message> {
		return this.request<Message>('POST', `/channels/${channelId}/messages`, {
			body: data,
		})
	}

	async sendMessageWithFiles(
		channelId: string,
		data: MessagePayload,
		filePaths: string[],
	): Promise<Message> {
		const form = new FormData()

		const files = await Promise.all(
			filePaths.map(async (filePath) => ({
				name: basename(filePath),
				bytes: await readFile(filePath),
			})),
		)

		const attachments = files.map((file, index) => ({
			id: index,
			filename: file.name,
		}))

		form.append('payload_json', JSON.stringify({ ...data, attachments }))
		for (const [index, file] of files.entries()) {
			form.append(`files[${index}]`, new Blob([file.bytes]), file.name)
		}

		return this.request<Message>('POST', `/channels/${channelId}/messages`, {
			body: form,
		})
	}

	async getMessages(
		channelId: string,
		limit = 50,
		before?: string,
	): Promise<Message[]> {
		const params = new URLSearchParams({
			limit: String(Math.min(limit, 100)),
		})
		if (before) params.set('before', before)
		return this.request<Message[]>(
			'GET',
			`/channels/${channelId}/messages?${params.toString()}`,
		)
	}

	async getMessage(channelId: string, messageId: string): Promise<Message> {
		return this.request<Message>(
			'GET',
			`/channels/${channelId}/messages/${messageId}`,
		)
	}

	async searchGuildMessages(options: {
		guildId: string
		content: string
		channelId?: string
		limit?: number
		offset?: number
	}): Promise<SearchGuildMessagesResponse> {
		const params = new URLSearchParams({
			content: options.content,
			limit: String(Math.min(options.limit ?? 25, 25)),
		})
		if (options.offset !== undefined)
			params.set('offset', String(options.offset))
		if (options.channelId) params.append('channel_id', options.channelId)

		return this.request<SearchGuildMessagesResponse>(
			'GET',
			`/guilds/${options.guildId}/messages/search?${params.toString()}`,
		)
	}

	async editMessage(
		channelId: string,
		messageId: string,
		data: MessagePayload,
	): Promise<Message> {
		return this.request<Message>(
			'PATCH',
			`/channels/${channelId}/messages/${messageId}`,
			{
				body: data,
			},
		)
	}

	async deleteMessage(
		channelId: string,
		messageId: string,
		reason?: string,
	): Promise<void> {
		await this.request<void>(
			'DELETE',
			`/channels/${channelId}/messages/${messageId}`,
			{ reason },
		)
	}

	async bulkDeleteMessages(
		channelId: string,
		messageIds: string[],
		reason?: string,
	): Promise<void> {
		await this.request<void>(
			'POST',
			`/channels/${channelId}/messages/bulk-delete`,
			{
				body: { messages: messageIds },
				reason,
			},
		)
	}

	async addReaction(
		channelId: string,
		messageId: string,
		emoji: string,
	): Promise<void> {
		await this.request<void>(
			'PUT',
			`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
		)
	}

	async removeReaction(
		channelId: string,
		messageId: string,
		emoji: string,
	): Promise<void> {
		await this.request<void>(
			'DELETE',
			`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
		)
	}

	async getChannelPins(
		channelId: string,
		before?: string,
	): Promise<ChannelPinsResponse> {
		const params = new URLSearchParams({ limit: '50' })
		if (before) params.set('before', before)
		return this.request<ChannelPinsResponse>(
			'GET',
			`/channels/${channelId}/messages/pins?${params.toString()}`,
		)
	}

	async pinMessage(
		channelId: string,
		messageId: string,
		reason?: string,
	): Promise<void> {
		await this.request<void>(
			'PUT',
			`/channels/${channelId}/messages/pins/${messageId}`,
			{
				reason,
			},
		)
	}

	async unpinMessage(
		channelId: string,
		messageId: string,
		reason?: string,
	): Promise<void> {
		await this.request<void>(
			'DELETE',
			`/channels/${channelId}/messages/pins/${messageId}`,
			{
				reason,
			},
		)
	}

	async createThread(
		channelId: string,
		name: string,
		messageId?: string,
	): Promise<Channel> {
		if (messageId) {
			return this.request<Channel>(
				'POST',
				`/channels/${channelId}/messages/${messageId}/threads`,
				{
					body: { name, auto_archive_duration: 1440 },
				},
			)
		}

		return this.request<Channel>('POST', `/channels/${channelId}/threads`, {
			body: { name, type: 11, auto_archive_duration: 1440 },
		})
	}

	async listEmojis(guildId: string): Promise<Emoji[]> {
		return this.request<Emoji[]>('GET', `/guilds/${guildId}/emojis`)
	}

	async createEmoji(
		guildId: string,
		name: string,
		filePath: string,
	): Promise<Emoji> {
		const bytes = await readFile(filePath)
		const extension = filePath.toLowerCase().endsWith('.gif') ? 'gif' : 'png'
		const image = `data:image/${extension};base64,${Buffer.from(bytes).toString('base64')}`
		return this.request<Emoji>('POST', `/guilds/${guildId}/emojis`, {
			body: { name, image },
		})
	}

	async deleteEmoji(guildId: string, emojiId: string): Promise<void> {
		await this.request<void>('DELETE', `/guilds/${guildId}/emojis/${emojiId}`)
	}
}

export type Guild = {
	id: string
	name: string
	icon: string | null
	owner: boolean
	permissions: string
}

export type GuildFull = Guild & {
	description: string | null
	approximate_member_count?: number
	approximate_presence_count?: number
	premium_tier: number
	premium_subscription_count: number
}

export type PermissionOverwrite = {
	id: string
	type: number
	allow: string
	deny: string
}

export type Channel = {
	id: string
	name: string
	type: number
	position: number
	parent_id: string | null
	topic?: string | null
	nsfw?: boolean
	rate_limit_per_user?: number
	bitrate?: number
	user_limit?: number
	permission_overwrites?: PermissionOverwrite[]
}

export type Role = {
	id: string
	name: string
	color: number
	position: number
	permissions: string
	managed: boolean
	mentionable: boolean
	hoist?: boolean
}

export type UserSummary = {
	id: string
	username: string
	global_name: string | null
	bot?: boolean
}

export type Member = {
	user?: UserSummary
	nick: string | null
	roles: string[]
	joined_at: string
}

export type EmbedField = {
	name: string
	value: string
	inline?: boolean
}

export type Embed = {
	title?: string
	description?: string
	url?: string
	color?: number
	timestamp?: string
	footer?: { text: string; icon_url?: string }
	image?: { url: string }
	thumbnail?: { url: string }
	author?: { name: string; url?: string; icon_url?: string }
	fields?: EmbedField[]
}

export type MessagePayload = {
	content?: string
	embeds?: Embed[]
	message_reference?: { message_id: string }
}

export type Attachment = {
	id: string
	filename: string
	size: number
	url: string
	content_type?: string
}

export type Message = {
	id: string
	channel_id: string
	content: string
	timestamp: string
	edited_timestamp: string | null
	pinned: boolean
	author: UserSummary
	embeds?: Embed[]
	attachments?: Attachment[]
}

export type MessagePin = {
	pinned_at: string
	message: Message
}

export type ChannelPinsResponse = {
	items: MessagePin[]
	has_more: boolean
}

export type SearchGuildMessagesResponse = {
	total_results: number
	messages: Message[][]
}

export type Emoji = {
	id: string
	name: string
	animated?: boolean
	available?: boolean
	managed?: boolean
}

export type Invite = {
	code: string
	channel: { id: string; name: string } | null
	inviter?: { id: string; username: string }
	uses: number
	max_uses: number
	max_age: number
	temporary: boolean
	created_at: string
}

export type AuditLogEntry = {
	id: string
	user_id: string | null
	target_id: string | null
	action_type: number
	reason?: string
	changes?: Array<{
		key: string
		old_value?: unknown
		new_value?: unknown
	}>
}

export type AuditLog = {
	audit_log_entries: AuditLogEntry[]
	users: Array<{ id: string; username: string }>
}
