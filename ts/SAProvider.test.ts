import { keccak256, randomBytes } from 'ethers'
import { MyAccount, SAProvider } from './SAProvider'
import { ECDSA_VALIDATOR_ADDRESS, OWNER_ADDRESS } from './sepolia_addresses'
import { describe, expect, it } from 'vitest'
import { JsonRpcProvider } from 'ethers'

describe('SAProvider', () => {
	it('should get the address of a new account', async () => {
		const saProvider = new SAProvider(new JsonRpcProvider(process.env.sepolia), new MyAccount())

		const address = await saProvider.account.getNewAddress(
			keccak256(randomBytes(32)),
			ECDSA_VALIDATOR_ADDRESS,
			OWNER_ADDRESS,
		)
		expect(address).toBeDefined()
	})
})
