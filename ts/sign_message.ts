import { concat, Contract, ethers, getBytes, hashMessage, Interface, keccak256, toUtf8Bytes, Wallet } from 'ethers'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)

console.log('signing message with signer', signer.address)

const message = 'hello world'
const messageHash = keccak256(toUtf8Bytes(message))
console.log('messageHash', messageHash)

console.log('hashMessage', hashMessage(getBytes(messageHash)))

const signature = await signer.signMessage(getBytes(messageHash)) // important to use getBytes!

console.log('signature', signature)

const iface = new Interface([
	'function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4)',
])
const isValidSignature = new Contract('0x8047a83E07CA902199e6b3BE6dB09AA4ABF3b3F7', iface, provider)

const isValid = await isValidSignature.isValidSignature(messageHash, signature)
console.log('isValid', isValid)
