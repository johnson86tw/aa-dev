import { concat, ethers, formatEther, getBytes, parseEther, toBeHex, Wallet, zeroPadValue } from 'ethers'
import { createEntryPoint, ENTRYPOINT, fetchUserOpHash, type UserOperation } from './utils'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY

const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const sender = '0x67CE34Bc421060B8594CdD361cE201868845045b' // MyAccount
const ecdsaValidator = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)

const entrypoint = createEntryPoint(provider)

// Build nonce
const nonceKey = zeroPadValue(ecdsaValidator, 24)
const nonce = toBeHex(await entrypoint.getNonce(sender, nonceKey))
console.log('nonce', nonce)

/**
 * Build callData
 *
 * ModeCode:
 * |--------------------------------------------------------------------|
 * | CALLTYPE  | EXECTYPE  |   UNUSED   | ModeSelector  |  ModePayload  |
 * |--------------------------------------------------------------------|
 * | 1 byte    | 1 byte    |   4 bytes  | 4 bytes       |   22 bytes    |
 * |--------------------------------------------------------------------|
 */
const modeCode = concat(['0x00', '0x00', '0x00000000', '0x00000000', '0x00000000000000000000000000000000000000000000'])
const execution = {
	target: '0xd78B5013757Ea4A7841811eF770711e6248dC282', // owner
	value: parseEther('0.001'),
	data: '0x',
}

const abiCoder = new ethers.AbiCoder()
const encodedData = abiCoder.encode(
	['address', 'uint256', 'bytes'],
	[execution.target, execution.value, execution.data],
)
const callData = abiCoder.encode(['bytes32', 'bytes'], [modeCode, encodedData])

// Build gas
const callGasLimit = 100_000n
const verificationGasLimit = 1_000_000_000_000n
const preVerificationGas = 1_000_000_000_000n
const maxPriorityFeePerGas = 1_000_000_000_000n
const maxFeePerGas = 1_000_000_000_000n

const userOp: UserOperation = {
	sender,
	nonce,
	factory: null,
	factoryData: '0x',
	callData,
	callGasLimit: toBeHex(callGasLimit),
	verificationGasLimit: toBeHex(verificationGasLimit),
	preVerificationGas: toBeHex(preVerificationGas),
	maxFeePerGas: toBeHex(maxFeePerGas),
	maxPriorityFeePerGas: toBeHex(maxPriorityFeePerGas),
	paymaster: null,
	paymasterVerificationGasLimit: toBeHex(0n),
	paymasterPostOpGasLimit: toBeHex(0n),
	paymasterData: null,
	signature: '0x',
}

const userOpHash = await fetchUserOpHash(userOp, provider)
console.log('userOpHash', userOpHash)

console.log('signing message... by', signer.address)
const signature = await signer.signMessage(getBytes(userOpHash))
console.log('raw signature', signature)

const userOpSignature = concat([ecdsaValidator, signature])
userOp.signature = userOpSignature

console.log('userOp', userOp)

const senderBalance = await provider.getBalance(sender)
console.log('sender balance', formatEther(senderBalance))

const res = await fetch(BUNDLER_URL, {
	method: 'post',
	headers: {
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		jsonrpc: '2.0',
		method: 'eth_sendUserOperation',
		id: 1,
		params: [userOp, ENTRYPOINT],
	}),
})
const result = await res.json()
console.log(result)
