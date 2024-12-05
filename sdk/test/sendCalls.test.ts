import { parseEther, toBeHex, Wallet } from 'ethers'
import { ECDSAValidator } from '../accountValidators'
import { MyAccount } from '../accountVendors'
import { addresses } from '../constants'
import { SAProvider } from '../SAProvider'
import type { CallsResult } from '../types'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const CLIENT_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const provider = new SAProvider({
	chainId: 11155111,
	validator: new ECDSAValidator({
		clientUrl: CLIENT_URL,
		signer: new Wallet(PRIVATE_KEY),
		address: addresses.sepolia.ECDSA_VALIDATOR,
	}),
	vendor: new MyAccount(),
	clientUrl: CLIENT_URL,
	bundlerUrl: BUNDLER_URL,
})

const accounts = await provider.requestAccounts()
const identifier = await provider.sendCalls({
	version: '1',
	from: accounts[1],
	calls: [
		{
			to: '0xd78B5013757Ea4A7841811eF770711e6248dC282',
			data: '0x',
			value: toBeHex(parseEther('0.001')),
		},
	],
})
const receipts = await provider.waitForReceipts(identifier)
console.log(receipts)
