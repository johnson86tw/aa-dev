import { concat, Contract, ethers, formatEther, getBytes, Interface, toBeHex, Wallet, zeroPadValue } from 'ethers'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY

// pimlico
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`
// alchemy
// const BUNDLER_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' // v0.7
const sender = '0xcb1b73e62150a8dc4a9b04206d6eb0d9e99984b9' // my SCA

// get nonce from entrypoint
const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)

const IEntryPoint = new Interface([
	'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
	'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
])
const entrypoint = new Contract(ENTRYPOINT, IEntryPoint, provider)
const nonce = toBeHex(await entrypoint.getNonce(sender, 0))

// get uo gas price from pimlico bundler
const gasPriceRes = await (
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

console.log('gasPriceRes', gasPriceRes)
const maxFeePerGas: string = gasPriceRes.result.standard.maxFeePerGas
const maxPriorityFeePerGas: string = gasPriceRes.result.standard.maxPriorityFeePerGas

// construct uo for bundler
const uo = {
	sender,
	nonce,
	factory: null,
	factoryData: '0x',
	callData:
		'0xb61d27f60000000000000000000000009e8f8c3ad87dbe7acffc5f5800e7433c8df409f200000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000', // bytes
	callGasLimit: toBeHex(100_000n),
	verificationGasLimit: toBeHex(100_000n),
	preVerificationGas: toBeHex(48112n),
	maxFeePerGas: maxFeePerGas,
	maxPriorityFeePerGas: maxPriorityFeePerGas,
	paymaster: null,
	paymasterVerificationGasLimit: toBeHex(0n),
	paymasterPostOpGasLimit: toBeHex(0n),
	paymasterData: null,
	signature: '0x',
}

// construct userOp for entrypoint
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

uo.signature = signature
console.log('uo', uo)

// get required prefund
// ps: pimlico getRequiredPrefund: https://docs.pimlico.io/permissionless/reference/utils/getRequiredPrefund
const requiredGas =
	BigInt(uo.verificationGasLimit) +
	BigInt(uo.callGasLimit) +
	(BigInt(uo.paymasterVerificationGasLimit) || 0n) +
	(BigInt(uo.paymasterPostOpGasLimit) || 0n) +
	BigInt(uo.preVerificationGas)

const requiredPrefund = requiredGas * BigInt(uo.maxFeePerGas)
console.log('requiredPrefund in ether', formatEther(requiredPrefund))

const senderBalance = await provider.getBalance(sender)
console.log('senderBalance', formatEther(senderBalance))

// send a user operation
function sendUserOp(userOp: any) {
	return fetch(BUNDLER_URL, {
		method: 'post',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			method: 'eth_sendUserOperation',
			id: 1,
			params: [uo, ENTRYPOINT],
		}),
	})
}

console.log(await (await sendUserOp(userOp)).json())
