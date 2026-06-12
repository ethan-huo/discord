import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createContext } from './runtime.ts'

let testConfigDir = ''
const originalConfigDir = process.env.DISCORD_CONFIG_DIR
const originalToken = process.env.DISCORD_TOKEN

beforeEach(async () => {
	testConfigDir = await mkdtemp(join(tmpdir(), 'discord-runtime-'))
	process.env.DISCORD_CONFIG_DIR = testConfigDir
	delete process.env.DISCORD_TOKEN
})

afterEach(async () => {
	if (originalConfigDir === undefined) {
		delete process.env.DISCORD_CONFIG_DIR
	} else {
		process.env.DISCORD_CONFIG_DIR = originalConfigDir
	}

	if (originalToken === undefined) {
		delete process.env.DISCORD_TOKEN
	} else {
		process.env.DISCORD_TOKEN = originalToken
	}

	if (testConfigDir) {
		await rm(testConfigDir, { recursive: true, force: true })
	}
})

describe('runtime context', () => {
	test('createContext resolves defaults without a config file', async () => {
		const context = await createContext({})

		expect(context.config.file).toBeNull()
		expect(context.config.resolved).toEqual({
			format: 'yaml',
			server: undefined,
			token: undefined,
		})
		expect(context.client).toBeUndefined()
	})

	test('createContext promotes env token into context', async () => {
		process.env.DISCORD_TOKEN = 'env-token'

		const context = await createContext({})

		expect(context.config.resolved.token).toBe('env-token')
		expect(context.client).toBeDefined()
	})
})
