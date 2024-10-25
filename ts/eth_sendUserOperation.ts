import { Interface } from 'ethers'
import { ethers, Contract } from 'ethers'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia) {
	throw new Error('Missing .env')
}

const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' // v0.7
const sender = '0xcb1b73e62150a8dc4a9b04206d6eb0d9e99984b9'

// get nonce from entrypoint
const provider = new ethers.JsonRpcProvider(RPC_URL)

const IEntryPoint = new Interface([
	'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
])

const entrypoint = new Contract(ENTRYPOINT, IEntryPoint, provider)

const nonce: bigint = await entrypoint.getNonce(sender, 0)

const response = await fetch(BUNDLER_URL, {
	method: 'post',
	headers: {
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		jsonrpc: '2.0',
		method: 'eth_sendUserOperation',
		id: 1,
		params: [
			{
				sender, // address
				nonce, // uint256
				factory, // address
				factoryData, // bytes
				callData, // bytes
				callGasLimit, // uint256
				verificationGasLimit, // uint256
				preVerificationGas, // uint256
				maxFeePerGas, // uint256
				maxPriorityFeePerGas, // uint256
				paymaster, // address
				paymasterVerificationGasLimit, // uint256
				paymasterPostOpGasLimit, // uint256
				paymasterData, // bytes
				signature, // bytes
			},
			entryPoint: ENTRYPOINT, // address
		],
	}),
})

const res = await response.json()

console.log(res)
