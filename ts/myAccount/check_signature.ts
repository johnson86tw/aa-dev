import { concat, Contract, ethers, getBytes, Interface, parseEther, toBeHex, Wallet, zeroPadValue } from 'ethers'
import { createEntryPoint, fetchUserOpHash, type UserOperation } from './utils'

if (!process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia

const sender = '0x67CE34Bc421060B8594CdD361cE201868845045b' // MyAccount
const ecdsaValidator = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)

const entrypoint = createEntryPoint(provider)

// Construct nonce
const nonceKey = zeroPadValue(ecdsaValidator, 24)
const nonce = toBeHex(await entrypoint.getNonce(sender, nonceKey))

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

const callGasLimit = 100_000n
const verificationGasLimit = 1000000000000n
const preVerificationGas = 100000000000n
const maxPriorityFeePerGas = 100000000000n
const maxFeePerGas = 100000000000n

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

const userOpHash: string = await fetchUserOpHash(userOp, provider)
console.log('userOpHash', userOpHash)

console.log('signing message...', signer.address)
const signature = await signer.signMessage(getBytes(userOpHash))

const userOpSignature = concat([ecdsaValidator, signature])
userOp.signature = userOpSignature

const IMyAccount = new Interface([
	'function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)',
])

const myAccount = new Contract(sender, IMyAccount, provider)
const res = await myAccount.isValidSignature(userOpHash, userOpSignature)
console.log(res === '0x1626ba7e')
