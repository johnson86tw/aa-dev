import { createPublicClient, http } from 'viem'
import { mekong } from './common'
import { privateKeyToAccount } from 'viem/accounts'

const publicClient = createPublicClient({
	chain: mekong,
	transport: http(),
})

// Get private key from env and create account
const privateKey = process.env.PRIVATE_KEY?.slice(2) // Remove '0x' prefix
if (!privateKey) {
	throw new Error('Private key not found in environment variables')
}

const account = privateKeyToAccount(`0x${privateKey}`)
console.log('Address:', account.address)

// Get code at address
const code = await publicClient.getCode({
	address: account.address as `0x${string}`,
})
console.log('Code:', code)
