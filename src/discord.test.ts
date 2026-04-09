import { afterEach, describe, expect, test } from 'bun:test'

import { DiscordClient } from './discord.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
})

describe('DiscordClient self identity and nickname helpers', () => {
	test('getCurrentUser calls the bot identity endpoint', async () => {
		const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
		globalThis.fetch = (async (input, init) => {
			requests.push({ input, init })
			return new Response(
				JSON.stringify({
					id: 'bot-1',
					username: 'discord-bot',
					global_name: null,
					bot: true,
				}),
				{
					status: 200,
					headers: { 'content-type': 'application/json' },
				},
			)
		}) as typeof fetch

		const client = new DiscordClient('token')
		const user = await client.getCurrentUser()

		expect(user.id).toBe('bot-1')
		expect(requests).toHaveLength(1)
		expect(String(requests[0]?.input)).toBe(
			'https://discord.com/api/v10/users/@me',
		)
		expect(requests[0]?.init?.method).toBe('GET')
		expect((requests[0]?.init?.headers as Headers).get('Authorization')).toBe(
			'Bot token',
		)
	})

	test('modifyOwnNickname uses the @me nickname endpoint', async () => {
		const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
		globalThis.fetch = (async (input, init) => {
			requests.push({ input, init })
			return new Response(null, { status: 204 })
		}) as typeof fetch

		const client = new DiscordClient('token')
		await client.modifyOwnNickname('guild-1', 'NewBotNick')

		expect(requests).toHaveLength(1)
		expect(String(requests[0]?.input)).toBe(
			'https://discord.com/api/v10/guilds/guild-1/members/@me/nick',
		)
		expect(requests[0]?.init?.method).toBe('PATCH')
		expect((requests[0]?.init?.headers as Headers).get('Authorization')).toBe(
			'Bot token',
		)
		expect((requests[0]?.init?.headers as Headers).get('Content-Type')).toBe(
			'application/json',
		)
		expect(requests[0]?.init?.body).toBe(JSON.stringify({ nick: 'NewBotNick' }))
	})
})
