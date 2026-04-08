import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { saveFileConfig } from '../config.ts'
import { serverHandlers } from './server.ts'

let testDir = ''

beforeEach(async () => {
	testDir = await mkdtemp(join(tmpdir(), 'discord-server-handler-'))
})

afterEach(async () => {
	if (testDir) {
		await rm(testDir, { recursive: true, force: true })
	}
})

describe('server select', () => {
	test('does not echo persisted tokens in command output', async () => {
		await saveFileConfig(
			{ token: 'secret-token' },
			join(testDir, 'config.json'),
		)

		const output: string[] = []
		const originalLog = console.log
		console.log = (value?: unknown) => {
			output.push(String(value ?? ''))
		}

		try {
			await serverHandlers.server.select({
				input: { id: 'guild-1' },
				context: {
					config: {
						dir: testDir,
						path: join(testDir, 'config.json'),
						file: { token: 'secret-token' },
						resolved: {
							token: 'secret-token',
							format: 'json',
						},
					},
					client: {
						getGuild: async () => ({
							id: 'guild-1',
							name: 'Guild One',
							icon: null,
							owner: false,
							permissions: '0',
							description: null,
							premium_tier: 0,
							premium_subscription_count: 0,
						}),
					} as never,
				},
				meta: {
					path: ['server', 'select'],
					command: 'server select',
					raw: [],
				},
			})
		} finally {
			console.log = originalLog
		}

		const printed = output.join('\n')
		expect(printed).not.toContain('secret-token')

		const savedConfig = await readFile(join(testDir, 'config.json'), 'utf8')
		expect(savedConfig).toContain('"token": "secret-token"')
		expect(savedConfig).toContain('"server": "guild-1"')
	})
})
