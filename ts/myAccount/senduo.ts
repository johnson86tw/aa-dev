import { concat, ethers, formatEther, getBytes, Interface, parseEther, toBeHex, Wallet, zeroPadValue } from 'ethers'
import {
	createEntryPoint,
	ENTRYPOINT,
	fetchUserOpHash,
	getHandleOpsCalldata,
	Bundler,
	type UserOperation,
} from './utils'

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

const IMyAccount = new Interface(['function execute(bytes32 mode, bytes calldata executionCalldata)'])
const callData = IMyAccount.encodeFunctionData('execute', [modeCode, executionCalldata])

const bundler = new Bundler(BUNDLER_URL)

const currentGasPrice = await bundler.request('pimlico_getUserOperationGasPrice')
const maxFeePerGas = currentGasPrice.standard.maxFeePerGas
const maxPriorityFeePerGas = currentGasPrice.standard.maxPriorityFeePerGas

// make sure the length is same as the actual one. it must be set to call eth_estimateUserOperationGas
const dummySignature =
	'0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'

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

const estimateGas = await bundler.request('eth_estimateUserOperationGas', [userOp, ENTRYPOINT])
console.log('estimateGas', estimateGas)

userOp.preVerificationGas = estimateGas.preVerificationGas
userOp.verificationGasLimit = estimateGas.verificationGasLimit
userOp.callGasLimit = estimateGas.callGasLimit
userOp.paymasterVerificationGasLimit = estimateGas.paymasterVerificationGasLimit
userOp.paymasterPostOpGasLimit = estimateGas.paymasterPostOpGasLimit

// Sign signature
const userOpHash = await fetchUserOpHash(userOp, provider)
console.log('userOpHash', userOpHash)

console.log('signing userOpHash... by', signer.address)
const signature = await signer.signMessage(getBytes(userOpHash))

userOp.signature = signature

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
