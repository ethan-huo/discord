import { describe, expect, test } from 'bun:test'

import type { Member } from './discord.ts'

import { CliError } from './errors.ts'
import { resolveMember } from './resolve.ts'

type MemberResolverClient = {
	getMember: (guildId: string, userId: string) => Promise<Member>
	listMembers: (guildId: string, limit?: number) => Promise<Member[]>
	searchMembers: (
		guildId: string,
		query: string,
		limit?: number,
	) => Promise<Member[]>
}

function createMember(
	id: string,
	username: string,
	options?: { globalName?: string; nick?: string },
): Member {
	return {
		user: {
			id,
			username,
			global_name: options?.globalName ?? null,
		},
		nick: options?.nick ?? null,
		roles: [],
		joined_at: '2026-01-01T00:00:00.000Z',
	}
}

describe('resolveMember', () => {
	test('rejects prefix-only matches returned by guild member search', async () => {
		const alice = createMember('1', 'alice')
		const client: MemberResolverClient = {
			getMember: async () => alice,
			searchMembers: async () => [alice],
			listMembers: async () => [alice],
		}

		const error = await resolveMember(client as never, 'guild', 'al').catch(
			(value) => value,
		)

		expect(error).toBeInstanceOf(CliError)
		expect(error.exitCode).toBe(2)
		expect(error.message).toContain('Member "al" matched only by prefix.')
	})

	test('falls back to an exact global_name scan when guild member search misses it', async () => {
		const member = createMember('1', 'alice', { globalName: 'Alice Display' })
		const client: MemberResolverClient = {
			getMember: async () => member,
			searchMembers: async () => [],
			listMembers: async () => [member],
		}

		await expect(
			resolveMember(client as never, 'guild', 'Alice Display'),
		).resolves.toBe(member)
	})

	test('prefers direct numeric user IDs without invoking search', async () => {
		const member = createMember('42', 'alice')
		let searchCalls = 0
		let listCalls = 0
		let getCalls = 0
		const client: MemberResolverClient = {
			getMember: async () => {
				getCalls += 1
				return member
			},
			searchMembers: async () => {
				searchCalls += 1
				return []
			},
			listMembers: async () => {
				listCalls += 1
				return []
			},
		}

		await expect(resolveMember(client as never, 'guild', '42')).resolves.toBe(
			member,
		)
		expect(getCalls).toBe(1)
		expect(searchCalls).toBe(0)
		expect(listCalls).toBe(0)
	})
})
