import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { privateKeyToAccount } from 'viem/accounts'
import { writeContract } from 'viem/actions'
import { eip7702Actions } from 'viem/experimental'
import { mekong } from './common'

if (!process.env.PIMLICO_API_KEY || !process.env.ALCHEMY_API_KEY || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`

const publicClient = createPublicClient({
	chain: mekong,
	transport: http(),
})

const walletClient = createWalletClient({
	account: privateKeyToAccount(PRIVATE_KEY),
	chain: mekong,
	transport: http(),
}).extend(eip7702Actions())

const MyAccountImplAddress = '0x2127c3c7374ae16ca732d799b785b42bac5ebc0e'

const authorization = await walletClient.signAuthorization({
	contractAddress: MyAccountImplAddress,
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

// const txHash = await writeContract(walletClient, {
// 	address: MyAccountImplAddress,
// 	abi: parseAbi(['function initialize(address anEntryPoint, address validator, bytes calldata data)']),
// 	functionName: 'initialize',
// 	args: [entryPoint07Address, '0x0581595879706B1e690C338b6198cD5F1525Da20', walletClient.account.address],
// 	account: walletClient.account,
// 	authorizationList: [authorization],
// 	// maxPriorityFeePerGas: parseGwei("1.5"),
// 	// maxFeePerGas: parseGwei("2"),
// })

// console.log('Transaction Hash:', txHash)
