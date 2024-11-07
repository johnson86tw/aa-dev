import { concat, Contract, ethers, formatEther, getBytes, Interface, toBeHex, Wallet, zeroPadValue } from 'ethers'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY

// pimlico
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' // v0.7
const sender = '0xFb290E1972B7ddfB2b2F807D357e9f80744f2381' // my SCA
const ecdsaValidator = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'

// get nonce from entrypoint
const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)

const IEntryPoint = new Interface([
	'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
	'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
])
const entrypoint = new Contract(ENTRYPOINT, IEntryPoint, provider)

// Construct nonce
const nonceKey = zeroPadValue(ecdsaValidator, 24)
const nonce = toBeHex(await entrypoint.getNonce(sender, nonceKey))

console.log('nonce', nonce)

const callGasLimit = 100_000n
const verificationGasLimit = 1000000000000n
const preVerificationGas = 100000000000n
const maxPriorityFeePerGas = 100000000000n
const maxFeePerGas = 100000000000n

const uo = {
	sender,
	nonce,
	factory: null,
	factoryData: '0x',
	callData:
		'0xb61d27f60000000000000000000000009e8f8c3ad87dbe7acffc5f5800e7433c8df409f200000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000', // bytes
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

// construct userOp for entrypoint only to generate userHash
const userOp = {
	sender,
	nonce,
	initCode: '0x',
	callData: uo.callData,
	accountGasLimits: concat([
		zeroPadValue(toBeHex(uo.callGasLimit), 16),
		zeroPadValue(toBeHex(uo.verificationGasLimit), 16),
	]),
	preVerificationGas: uo.preVerificationGas,
	gasFees: concat([zeroPadValue(toBeHex(uo.maxPriorityFeePerGas), 16), zeroPadValue(toBeHex(uo.maxFeePerGas), 16)]),
	paymasterAndData: uo.paymaster && uo.paymasterData ? concat([uo.paymaster, uo.paymasterData]) : '0x',
	signature: '0x',
}

console.log('userOp', userOp)

// Sign signature and add to userOp
const userOpHash: string = await entrypoint.getUserOpHash(userOp)
console.log('userOpHash', userOpHash)

console.log('signing message...', signer.address)
const signature = await signer.signMessage(getBytes(userOpHash))
console.log('signature', signature)

const uoSignature = concat([ecdsaValidator, signature])
console.log('uoSignature', uoSignature)

uo.signature = uoSignature

const IMyAccount = new Interface([
	'function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)',
])

const myAccount = new Contract(sender, IMyAccount, provider)
const res = await myAccount.isValidSignature(userOpHash, uoSignature)
console.log(res === '0x1626ba7e')
