import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { privateKeyToAccount } from 'viem/accounts'
import { writeContract } from 'viem/actions'
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

// With initialize
// Note that when the contract is initialized, it can't be delegated to
const txHash = await writeContract(walletClient, {
	address: MyAccountImplAddress,
	abi: parseAbi(['function initialize(address anEntryPoint, address validator, bytes calldata data)']),
	functionName: 'initialize',
	args: [entryPoint07Address, '0x0581595879706B1e690C338b6198cD5F1525Da20', walletClient.account.address],
	account: walletClient.account,
	authorizationList: [authorization],
})

console.log('Transaction Hash:', txHash)

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
console.log('Transaction confirmed:', receipt)
