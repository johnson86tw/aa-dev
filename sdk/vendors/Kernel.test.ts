import { hexlify, JsonRpcProvider, randomBytes } from 'ethers'
import { Kernel } from './Kernel'
import { expect, describe, it } from 'vitest'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const CLIENT_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

describe('Kernel', () => {
	describe('getInitializeData', () => {
		it('should return correct initialization data', async () => {
			const kernel = new Kernel()
			const validatorAddress = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'
			const owner = '0xd78B5013757Ea4A7841811eF770711e6248dC282'

			const data = (kernel as any).getInitializeData(validatorAddress, owner)

			expect(typeof data).toBe('string')
			expect(data.startsWith('0x')).toBe(true)
		})

		it('should throw error for invalid addresses', () => {
			const kernel = new Kernel()
			const invalidAddress = '0x123' // Invalid address

			expect(() => {
				;(kernel as any).getInitializeData(invalidAddress, invalidAddress)
			}).toThrow('Invalid address')
		})
	})

	describe('getCreateAccountData', () => {
		it('should return correct create account data', async () => {
			const kernel = new Kernel()
			const validatorAddress = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'
			const owner = '0xd78B5013757Ea4A7841811eF770711e6248dC282'
			const salt = hexlify(randomBytes(32))

			const data = (kernel as any).getCreateAccountData(validatorAddress, owner, salt)

			expect(typeof data).toBe('string')
			expect(data.startsWith('0x')).toBe(true)
		})

		it('should throw error for invalid addresses or salt', () => {
			const kernel = new Kernel()
			const invalidAddress = '0x123'
			let salt = '0x12345678901234567890123456789012345678901234567890123456789012345678910'

			expect(() => {
				;(kernel as any).getCreateAccountData(invalidAddress, invalidAddress, salt)
			}).toThrow('Salt should be 32 bytes')

			salt = hexlify(randomBytes(32))

			expect(() => {
				;(kernel as any).getCreateAccountData(invalidAddress, invalidAddress, salt)
			}).toThrow('Invalid address')
		})
	})

	describe('getAddress', () => {
		it('should not return zero address', async () => {
			const kernel = new Kernel()
			const validatorAddress = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'
			const owner = '0xd78B5013757Ea4A7841811eF770711e6248dC282'
			const salt = hexlify(randomBytes(32))

			const address = await kernel.getAddress(new JsonRpcProvider(CLIENT_URL), validatorAddress, owner, salt)
			expect(address).not.toBe('0x0000000000000000000000000000000000000000')
		})
	})
})
