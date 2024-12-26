import { createPublicClient, createWalletClient, http, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { eip7702Actions } from 'viem/experimental'
import { mekong } from './common'

if (!process.env.PIMLICO_API_KEY || !process.env.ALCHEMY_API_KEY || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const publicClient = createPublicClient({
	chain: mekong,
	transport: http(),
})

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`

export const walletClient = createWalletClient({
	account: privateKeyToAccount(PRIVATE_KEY),
	chain: mekong,
	transport: http(),
}).extend(eip7702Actions())

const authorization = await walletClient.signAuthorization({
	contractAddress: zeroAddress,
})

console.log('authorization', authorization)

const txHash = await walletClient.sendTransaction({
	to: '0x0000000000000000000000000000000000000000',
	value: 0n,
	account: walletClient.account,
	authorizationList: [authorization],
})

console.log('Transaction Hash:', txHash)

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
console.log('Transaction confirmed:', receipt)
