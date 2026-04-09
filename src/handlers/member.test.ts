import { afterEach, describe, expect, test } from 'bun:test'

import type { Member, UserSummary } from '../discord.ts'

import { memberHandlers } from './member.ts'

function createMember(user: UserSummary): Member {
	return {
		user,
		nick: null,
		roles: [],
		joined_at: '2026-01-01T00:00:00.000Z',
	}
}

function createContext(client: object) {
	return {
		config: {
			dir: '/tmp',
			path: '/tmp/config.json',
			file: null,
			resolved: {
				token: 'token',
				server: 'guild-1',
				format: 'json' as const,
			},
		},
		client: client as never,
	}
}

afterEach(() => {
	process.exitCode = undefined
})

describe('member nick', () => {
	test('uses the self nickname endpoint when renaming the current bot', async () => {
		const member = createMember({
			id: '101',
			username: 'discord-bot',
			global_name: null,
			bot: true,
		})
		const modifyMemberCalls: Array<{
			guildId: string
			userId: string
			data: Record<string, unknown>
		}> = []
		const ownNickCalls: Array<{ guildId: string; nick: string }> = []
		const output: string[] = []
		const originalLog = console.log
		console.log = (value?: unknown) => {
			output.push(String(value ?? ''))
		}

		try {
			await memberHandlers.member.nick({
				input: { user: '101', nickname: 'NewBotNick' },
				context: createContext({
					getMember: async () => member,
					getCurrentUser: async () => member.user,
					modifyMember: async (
						guildId: string,
						userId: string,
						data: Record<string, unknown>,
					) => {
						modifyMemberCalls.push({ guildId, userId, data })
						return member
					},
					modifyOwnNickname: async (guildId: string, nick: string) => {
						ownNickCalls.push({ guildId, nick })
					},
				}),
				meta: {
					path: ['member', 'nick'],
					command: 'member nick',
					raw: [],
				},
			})
		} finally {
			console.log = originalLog
		}

		expect(modifyMemberCalls).toHaveLength(0)
		expect(ownNickCalls).toEqual([{ guildId: 'guild-1', nick: 'NewBotNick' }])
		expect(JSON.parse(output.at(-1) ?? '{}')).toEqual({
			action: 'set_member_nick',
			user: {
				id: '101',
				username: 'discord-bot',
			},
			nickname: 'NewBotNick',
		})
	})

	test('keeps using the member endpoint for other users', async () => {
		const member = createMember({
			id: '202',
			username: 'alice',
			global_name: null,
		})
		const modifyMemberCalls: Array<{
			guildId: string
			userId: string
			data: Record<string, unknown>
		}> = []
		const ownNickCalls: Array<{ guildId: string; nick: string }> = []
		const originalLog = console.log
		console.log = () => undefined

		try {
			await memberHandlers.member.nick({
				input: { user: '202', nickname: 'AliceNick' },
				context: createContext({
					getMember: async () => member,
					getCurrentUser: async () => ({
						id: '101',
						username: 'discord-bot',
						global_name: null,
						bot: true,
					}),
					modifyMember: async (
						guildId: string,
						userId: string,
						data: Record<string, unknown>,
					) => {
						modifyMemberCalls.push({ guildId, userId, data })
						return member
					},
					modifyOwnNickname: async (guildId: string, nick: string) => {
						ownNickCalls.push({ guildId, nick })
					},
				}),
				meta: {
					path: ['member', 'nick'],
					command: 'member nick',
					raw: [],
				},
			})
		} finally {
			console.log = originalLog
		}

		expect(modifyMemberCalls).toEqual([
			{
				guildId: 'guild-1',
				userId: '202',
				data: { nick: 'AliceNick' },
			},
		])
		expect(ownNickCalls).toHaveLength(0)
	})
})
