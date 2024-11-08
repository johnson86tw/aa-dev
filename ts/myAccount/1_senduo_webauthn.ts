import { concat, ethers, formatEther, getBytes, Interface, parseEther, toBeHex, Wallet, zeroPadValue } from 'ethers'
import { createEntryPoint, ENTRYPOINT, fetchUserOpHash, getHandleOpsCalldata, type UserOperation } from './utils'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY

const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const sender = '0x67CE34Bc421060B8594CdD361cE201868845045b' // MyAccount
const webauthnValidator = '0xf943a0a7f6a707a18773f2e62f66dbc03c1fcd00'

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)

const entrypoint = createEntryPoint(provider)

// Build nonce
const nonceKey = zeroPadValue(webauthnValidator, 24)
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

// make sure the length is same as the actual one. it must be set to call eth_estimateUserOperationGas
const dummySignature = '0x' + '0'.repeat(960)

const userOp: UserOperation = {
	sender,
	nonce,
	factory: null,
	factoryData: '0x',
	callData,
	callGasLimit: '0x0',
	verificationGasLimit: '0x0',
	preVerificationGas: '0x0',
	maxFeePerGas,
	maxPriorityFeePerGas,
	paymaster: null,
	paymasterVerificationGasLimit: '0x0',
	paymasterPostOpGasLimit: '0x0',
	paymasterData: null,
	signature: dummySignature,
}

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
console.log('estimateGas', estimateGas)

userOp.preVerificationGas = estimateGas.preVerificationGas
userOp.verificationGasLimit = toBeHex(7_963_089n)
userOp.callGasLimit = estimateGas.callGasLimit
userOp.paymasterVerificationGasLimit = estimateGas.paymasterVerificationGasLimit
userOp.paymasterPostOpGasLimit = estimateGas.paymasterPostOpGasLimit

// Sign signature
const userOpHash = await fetchUserOpHash(userOp, provider)
console.log('userOpHash', userOpHash)
console.log('userOp json', JSON.stringify(userOp))
