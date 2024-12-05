import { describe, expect, it } from 'vitest'
import { SAProvider } from './SAProvider'
import { Wallet } from 'ethers'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

describe('SAProvider', () => {
	it('should request chainId', async () => {
		const provider = new SAProvider({
			chainId: 11155111,
			validationType: 'ECDSAValidator',
			signer: new Wallet(PRIVATE_KEY),
			clientUrl: RPC_URL,
			bundlerUrl: BUNDLER_URL,
		})

		const chainId = await provider.request({ method: 'eth_chainId' })
		expect(chainId).toBe(11155111)
	})
})
