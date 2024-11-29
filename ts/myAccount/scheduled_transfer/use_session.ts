import { AbiCoder, concat, getBytes, Interface, JsonRpcProvider, toBeHex, Wallet, zeroPadValue } from 'ethers'
import {
	Bundler,
	createEntryPoint,
	ENTRYPOINT,
	fetchUserOpHash,
	getHandleOpsCalldata,
	type UserOperation,
} from '../utils'
import {
	MY_ACCOUNT_ADDRESS,
	padLeft,
	SCHEDULED_TRANSFER_ADDRESS,
	SMART_SESSION_ADDRESS,
	SMART_SESSIONS_USE_MODE,
} from './utils'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.SESSION_PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const SESSION_PRIVATE_KEY = process.env.SESSION_PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`
const PERMISSION_ID = '0xb72ded2811243e47314035a2ebc224f775e95edb8e4f26b883b2479d5be18b7a'

const sender = MY_ACCOUNT_ADDRESS // MyAccount
const provider = new JsonRpcProvider(RPC_URL)
const signer = new Wallet(SESSION_PRIVATE_KEY, provider) // use smart session signer

const entrypoint = createEntryPoint(provider)

// ================================ Build nonce ================================

const nonceKey = zeroPadValue(SMART_SESSION_ADDRESS, 24) // use smart session validator
const nonce = toBeHex(await entrypoint.getNonce(sender, nonceKey))

/**
 * ================================ Build callData ================================
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
	target: SCHEDULED_TRANSFER_ADDRESS,
	value: 0,
	data: new Interface(['function executeOrder(uint256 jobId)']).encodeFunctionData('executeOrder', [1]),
}

const executionCalldata = concat([execution.target, padLeft(toBeHex(execution.value)), execution.data])

const callData = new Interface(['function execute(bytes32 mode, bytes calldata executionCalldata)']).encodeFunctionData(
	'execute',
	[modeCode, executionCalldata],
)

// ================================ Get gas price ================================

const bundler = new Bundler(BUNDLER_URL)

const currentGasPrice = await bundler.request('pimlico_getUserOperationGasPrice')
const maxFeePerGas = currentGasPrice.standard.maxFeePerGas
const maxPriorityFeePerGas = currentGasPrice.standard.maxPriorityFeePerGas

// ================================ Build userOp ================================

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
	signature: '0x',
}

// ================================ Build dummy signature ================================

const dummySignature =
	'0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'

userOp.signature = concat([SMART_SESSIONS_USE_MODE, PERMISSION_ID, dummySignature])

console.log('userOp', userOp)

// ================================ Estimate gas ================================

const estimateGas = await bundler.request('eth_estimateUserOperationGas', [userOp, ENTRYPOINT])

userOp.preVerificationGas = estimateGas.preVerificationGas
userOp.verificationGasLimit = estimateGas.verificationGasLimit
userOp.callGasLimit = estimateGas.callGasLimit
userOp.paymasterVerificationGasLimit = estimateGas.paymasterVerificationGasLimit
userOp.paymasterPostOpGasLimit = estimateGas.paymasterPostOpGasLimit

// ================================ Sign signature ================================

const userOpHash = await fetchUserOpHash(userOp, provider)

console.log('signing userOpHash... by', signer.address)
const signature = await signer.signMessage(getBytes(userOpHash))

userOp.signature = concat([SMART_SESSIONS_USE_MODE, PERMISSION_ID, signature])

console.log('userOp', userOp)

const handlesOpsCalldata = getHandleOpsCalldata(userOp, sender)
console.log('handlesOpsCalldata', handlesOpsCalldata)

const requiredGas =
	BigInt(userOp.verificationGasLimit) +
	BigInt(userOp.callGasLimit) +
	(BigInt(userOp.paymasterVerificationGasLimit) || 0n) +
	(BigInt(userOp.paymasterPostOpGasLimit) || 0n) +
	BigInt(userOp.preVerificationGas)

const requiredPrefund = requiredGas * BigInt(userOp.maxFeePerGas)
const senderBalance = await provider.getBalance(sender)

if (senderBalance < requiredPrefund) {
	throw new Error(`Sender address does not have enough native tokens`)
}

const res = await bundler.request('eth_sendUserOperation', [userOp, ENTRYPOINT])

if (res) {
	let result = null
	console.log('Waiting for transaction receipt...')

	while (result === null) {
		result = await bundler.request('eth_getUserOperationReceipt', [userOpHash])

		if (result === null) {
			await new Promise(resolve => setTimeout(resolve, 1000))
			console.log('Still waiting for receipt...')
		}
	}

	console.log('Receipt', result)
	console.log('transactionHash', result.receipt.transactionHash)
} else {
	console.log(res)
}
