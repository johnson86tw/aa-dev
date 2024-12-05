import { beforeEach, describe, expect, it } from 'vitest'
import { SAProvider } from './SAProvider'
import { parseEther, toBeHex, Wallet } from 'ethers'
import { MyAccount } from './accountVendors'
import { ECDSAValidator } from './accountValidators'
import { addresses } from './constants'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const CLIENT_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

describe('SAProvider', () => {
	let provider: SAProvider

	beforeEach(() => {
		provider = new SAProvider({
			chainId: 11155111,
			validator: new ECDSAValidator({
				clientUrl: CLIENT_URL,
				signer: new Wallet(PRIVATE_KEY),
				address: addresses.sepolia.ECDSA_VALIDATOR,
			}),
			vendor: new MyAccount(),
			clientUrl: CLIENT_URL,
			bundlerUrl: BUNDLER_URL,
		})
	})

	it('should request chainId', async () => {
		const chainId = await provider.request({ method: 'eth_chainId' })
		expect(chainId).toBe(11155111)
	})

	it('should request accounts', async () => {
		const accounts = await provider.requestAccounts()
		expect(accounts).toEqual([
			'0xFb290E1972B7ddfB2b2F807D357e9f80744f2381',
			'0x67CE34Bc421060B8594CdD361cE201868845045b',
		])
	})

	it('should send calls', async () => {
		const accounts = await provider.requestAccounts()
		const result = await provider.sendCalls({
			version: '1',
			from: accounts[1],
			calls: [
				{
					to: '0xd78B5013757Ea4A7841811eF770711e6248dC282',
					data: '0x',
					value: toBeHex(parseEther('0.001')),
				},
			],
		})
		console.log(result)
	})
})
