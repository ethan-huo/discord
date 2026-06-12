import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
	getConfigDir,
	getConfigPath,
	loadFromFile,
	resolveConfigContext,
	saveFileConfig,
	updateFileConfig,
} from './config.ts'
import { CliError } from './errors.ts'

let testConfigDir = ''
const originalConfigDir = process.env.DISCORD_CONFIG_DIR
const originalToken = process.env.DISCORD_TOKEN
const originalServer = process.env.DISCORD_SERVER
const originalFormat = process.env.DISCORD_FORMAT

beforeEach(async () => {
	testConfigDir = await mkdtemp(join(tmpdir(), 'discord-'))
	process.env.DISCORD_CONFIG_DIR = testConfigDir
	delete process.env.DISCORD_TOKEN
	delete process.env.DISCORD_SERVER
	delete process.env.DISCORD_FORMAT
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

	if (originalServer === undefined) {
		delete process.env.DISCORD_SERVER
	} else {
		process.env.DISCORD_SERVER = originalServer
	}

	if (originalFormat === undefined) {
		delete process.env.DISCORD_FORMAT
	} else {
		process.env.DISCORD_FORMAT = originalFormat
	}

	if (testConfigDir) {
		await rm(testConfigDir, { recursive: true, force: true })
	}
})

describe('config storage', () => {
	test('saveFileConfig and loadFromFile round-trip the current config shape', async () => {
		await saveFileConfig({
			token: 'secret-token',
			server: '123',
			format: 'json',
		})

		await expect(loadFromFile()).resolves.toEqual({
			token: 'secret-token',
			server: '123',
			format: 'json',
		})
	})

	test('config file is optional', async () => {
		await expect(loadFromFile()).resolves.toBeNull()
	})

	test('updateFileConfig merges partial patches', async () => {
		await saveFileConfig({ token: 'secret-token' })
		await updateFileConfig({ server: '123' })

		await expect(loadFromFile()).resolves.toEqual({
			token: 'secret-token',
			server: '123',
		})
	})

	test('saveFileConfig writes config.json to the resolved config path', async () => {
		await saveFileConfig({ token: 'secret-token' })

		const content = await readFile(getConfigPath(), 'utf8')
		expect(content).toContain('"token": "secret-token"')
		expect(getConfigDir()).toBe(testConfigDir)
	})

	test('loadFromFile fails loudly on invalid json', async () => {
		await writeFile(join(getConfigDir(), 'config.json'), '{broken', 'utf8')

		await expect(loadFromFile()).rejects.toBeInstanceOf(CliError)
	})
})

describe('config resolution', () => {
	test('resolveConfigContext merges file config with env overrides', async () => {
		await saveFileConfig({
			token: 'file-token',
			server: 'file-server',
			format: 'yaml',
		})
		process.env.DISCORD_TOKEN = 'env-token'
		process.env.DISCORD_SERVER = 'env-server'
		process.env.DISCORD_FORMAT = 'json'

		const config = await resolveConfigContext({})

		expect(config.file).toEqual({
			token: 'file-token',
			server: 'file-server',
			format: 'yaml',
		})
		expect(config.resolved).toEqual({
			token: 'env-token',
			server: 'env-server',
			format: 'json',
		})
	})

	test('explicit globals override file and env values', async () => {
		await saveFileConfig({ server: 'file-server', format: 'yaml' })
		process.env.DISCORD_SERVER = 'env-server'
		process.env.DISCORD_FORMAT = 'yaml'

		const config = await resolveConfigContext({
			server: 'flag-server',
			json: true, // --json forces JSON over the file/env 'yaml' default
		})

		expect(config.resolved.server).toBe('flag-server')
		expect(config.resolved.format).toBe('json')
	})
})
