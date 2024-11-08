import { concat, ethers, formatEther, getBytes, Interface, parseEther, toBeHex, Wallet, zeroPadValue } from 'ethers'
import { createEntryPoint, ENTRYPOINT, fetchUserOpHash, getHandleOpsCalldata, type UserOperation } from './utils'
import { AbiCoder } from 'ethers'

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

// Build callData to install WebAuthn validator module
// sepolia WebAuthnValidator: 0xf943a0a7f6a707a18773f2e62f66dbc03c1fcd00
// function installModule(uint256 moduleTypeId, address module, bytes calldata initData)
// [1, 0xf943a0a7f6a707a18773f2e62f66dbc03c1fcd00, abi.encode(tuple(uint256 pubKeyX, uint256 pubKeyY), bytes32 authenticatorIdHash)]

const pubKeyX = 60892748959872516896188013384173876983319747466189122437265594598084775757749n
const pubKeyY = 24226848566609178530681690498727697443610042742567999018652094720544956264029n
const authenticatorIdHash = '0x730e69129559f38e0bc8c29bf3847f41313a0e52d07423373d09970367537e5b'

const abiCoder = new AbiCoder()

const iMyAccount = new Interface([
	'function installModule(uint256 moduleTypeId, address module, bytes calldata initData)',
])

const callData = iMyAccount.encodeFunctionData('installModule', [
	1,
	'0xf943a0a7f6a707a18773f2e62f66dbc03c1fcd00',
	abiCoder.encode(
		['tuple(uint256 pubKeyX, uint256 pubKeyY)', 'bytes32'],
		[{ pubKeyX, pubKeyY }, authenticatorIdHash],
	),
])

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

const res = await (
	await fetch(BUNDLER_URL, {
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
).json()

if (res.result) {
	let result = null
	console.log('Waiting for transaction receipt...')

	while (result === null) {
		result = (
			await (
				await fetch(BUNDLER_URL, {
					method: 'post',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						method: 'eth_getUserOperationReceipt',
						id: 1,
						params: [userOpHash],
					}),
				})
			).json()
		).result

		if (result === null) {
			await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
			console.log('Still waiting for receipt...')
		}
	}

	console.log('Receipt', result)
	console.log('transactionHash', result.receipt.transactionHash)
} else {
	console.log(res)
}
