#!/usr/bin/env bun

import { cli } from 'argc'

import packageJson from '../package.json' with { type: 'json' }
import { handlers } from './app-handlers.ts'
import { createContext } from './runtime.ts'
import { globalsSchema, schema } from './schema.ts'

const app = cli(schema, {
	name: 'discord',
	version: packageJson.version,
	description:
		'Discord server management CLI built for Bun-native agent workflows.',
	globals: globalsSchema,
	context: createContext,
})

await app.run({ handlers })
