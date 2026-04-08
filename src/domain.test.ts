import { describe, expect, test } from 'bun:test'

import {
	describePermissions,
	ensureSafeFilename,
	isBulkDeletableTimestamp,
	parseEmbedFields,
	parseHexColor,
	parsePermissionNames,
} from './domain.ts'

describe('domain helpers', () => {
	test('parseHexColor validates hex colors', () => {
		expect(parseHexColor('#5865F2')).toBe(5793266)
		expect(() => parseHexColor('oops')).toThrow()
	})

	test('parsePermissionNames understands 2026 permission splits', () => {
		const bitfield = parsePermissionNames('pin_messages,create_expressions')
		expect(describePermissions(bitfield)).toEqual(
			expect.arrayContaining(['pin_messages', 'create_expressions']),
		)
	})

	test('ensureSafeFilename strips traversal components', () => {
		expect(ensureSafeFilename('../../secrets.txt')).toBe('secrets.txt')
		expect(ensureSafeFilename('..\\..\\windows.txt')).toBe('windows.txt')
	})

	test('isBulkDeletableTimestamp enforces the 14-day bulk delete limit', () => {
		expect(isBulkDeletableTimestamp(new Date().toISOString())).toBe(true)
		expect(
			isBulkDeletableTimestamp(
				new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
			),
		).toBe(false)
	})

	test('parseEmbedFields normalizes repeated field inputs', () => {
		expect(parseEmbedFields(['Name|Value|inline'])).toEqual([
			{ name: 'Name', value: 'Value', inline: true },
		])
	})
})
