import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { eip7702Actions } from 'viem/experimental'
import { devnet5 } from './common'

if (!process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`

const publicClient = createPublicClient({
	chain: devnet5,
	transport: http(),
})

const walletClient = createWalletClient({
	account: privateKeyToAccount(PRIVATE_KEY),
	chain: devnet5,
	transport: http(),
}).extend(eip7702Actions())

const MyAccountImplAddress = '0xFB50e2aC85D869d12aEAcA6D1c5a33962a53ff42'

const authorization = await walletClient.signAuthorization({
	contractAddress: MyAccountImplAddress,
})

console.log('authorization', authorization)

// Without initialize
const txHash = await walletClient.sendTransaction({
	to: MyAccountImplAddress,
	value: 0n,
	account: walletClient.account,
	authorizationList: [authorization],
})

console.log('Transaction Hash:', txHash)

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
console.log('Transaction confirmed:', receipt)
