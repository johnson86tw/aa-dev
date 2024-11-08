import { concat, ethers, formatEther, getBytes, parseEther, toBeHex, Wallet, zeroPadBytes, zeroPadValue } from 'ethers'
import { createEntryPoint, ENTRYPOINT, fetchUserOpHash, getHandleOpsCalldata, type UserOperation } from './utils'
import { Interface } from 'ethers'

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

const executionCalldata = concat([execution.target, zeroPadValue(toBeHex(execution.value), 32), execution.data])
console.log('executionCalldata', executionCalldata)

const IMyAccount = new Interface(['function execute(bytes32 mode, bytes calldata executionCalldata)'])
const callData = IMyAccount.encodeFunctionData('execute', [modeCode, executionCalldata])

const currentGasPrice = (
	await (
		await fetch(BUNDLER_URL, {
			method: 'post',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'pimlico_getUserOperationGasPrice',
				id: 1,
				params: [],
			}),
		})
	).json()
).result

const maxFeePerGas = currentGasPrice.standard.maxFeePerGas
const maxPriorityFeePerGas = currentGasPrice.standard.maxPriorityFeePerGas

// Build gas
const callGasLimit = 100_000n
const verificationGasLimit = 100_000n
const preVerificationGas = 50_000n

const userOp: UserOperation = {
	sender,
	nonce,
	factory: null,
	factoryData: '0x',
	callData,
	callGasLimit: toBeHex(callGasLimit),
	verificationGasLimit: toBeHex(verificationGasLimit),
	preVerificationGas: toBeHex(preVerificationGas),
	maxFeePerGas: maxFeePerGas,
	maxPriorityFeePerGas: maxPriorityFeePerGas,
	paymaster: null,
	paymasterVerificationGasLimit: toBeHex(0n),
	paymasterPostOpGasLimit: toBeHex(0n),
	paymasterData: null,
	signature: '0x',
}

let userOpHash = await fetchUserOpHash(userOp, provider)
console.log('userOpHash', userOpHash)

console.log('signing message... by', signer.address)
let signature = await signer.signMessage(getBytes(userOpHash))
userOp.signature = signature

const estimateGas = (
	await (
		await fetch(BUNDLER_URL, {
			method: 'post',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'eth_estimateUserOperationGas',
				id: 1,
				params: [userOp, ENTRYPOINT],
			}),
		})
	).json()
).result
console.log(estimateGas)

// why cannot modify? it complaint AA24 signature error ??
// userOp.preVerificationGas = estimateGas.preVerificationGas
// userOp.verificationGasLimit = estimateGas.verificationGasLimit
// userOp.callGasLimit = estimateGas.callGasLimit
// userOp.paymasterVerificationGasLimit = estimateGas.paymasterVerificationGasLimit
// userOp.paymasterPostOpGasLimit = estimateGas.paymasterPostOpGasLimit

// sign again!
const realUserOpHash = await fetchUserOpHash(userOp, provider)
console.log('userOpHash', realUserOpHash)

console.log('signing message... by', signer.address)
const realSignature = await signer.signMessage(getBytes(realUserOpHash))

userOp.signature = realSignature

// ==================================================================================================

console.log('userOp', userOp)

const handlesOpsCalldata = getHandleOpsCalldata(userOp, sender)
console.log('handlesOpsCalldata', handlesOpsCalldata)

// Get required prefund
const requiredGas =
	BigInt(userOp.verificationGasLimit) +
	BigInt(userOp.callGasLimit) +
	(BigInt(userOp.paymasterVerificationGasLimit) || 0n) +
	(BigInt(userOp.paymasterPostOpGasLimit) || 0n) +
	BigInt(userOp.preVerificationGas)

const requiredPrefund = requiredGas * BigInt(userOp.maxFeePerGas)
console.log('requiredPrefund in ether', formatEther(requiredPrefund))

const senderBalance = await provider.getBalance(sender)
console.log('sender balance', formatEther(senderBalance))

if (senderBalance < requiredPrefund) {
	throw new Error(`Sender address does not have enough native tokens`)
}

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
