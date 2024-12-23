import { createWalletClient, http, parseAbi } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { privateKeyToAccount } from 'viem/accounts'
import { writeContract } from 'viem/actions'

import { eip7702Actions } from 'viem/experimental'

const mekong = {
	id: 7078815900,
	name: 'Mekong',
	nativeCurrency: { name: 'Mekong Ether', symbol: 'ETH', decimals: 18 },
	rpcUrls: {
		default: {
			http: ['https://rpc.mekong.ethpandaops.io'],
		},
	},
	blockExplorers: {
		default: {
			name: 'Etherscan',
			url: 'https://explorer.mekong.ethpandaops.io',
			apiUrl: '',
		},
	},
	testnet: true,
}

if (!process.env.PIMLICO_API_KEY || !process.env.ALCHEMY_API_KEY || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY

export const walletClient = createWalletClient({
	account: privateKeyToAccount(PRIVATE_KEY),
	chain: mekong,
	transport: http(),
}).extend(eip7702Actions())

const MyAccountImplAddress = '0x526BF866AD0AD63b71232F671bf1D17038D1ea52'

const authorization = await walletClient.signAuthorization({
	contractAddress: MyAccountImplAddress,
})

console.log('authorization', authorization)

const txHash = await writeContract(walletClient, {
	address: walletClient.account.address,
	abi: parseAbi(['function initialize(address anEntryPoint, address validator, bytes calldata data)']),
	functionName: 'initialize',
	args: [entryPoint07Address, '0x0581595879706B1e690C338b6198cD5F1525Da20', walletClient.account.address],
	account: walletClient.account,
	authorizationList: [authorization],
	// maxPriorityFeePerGas: parseGwei("1.5"),
	// maxFeePerGas: parseGwei("2"),
})

console.log('Transaction Hash:', txHash)
