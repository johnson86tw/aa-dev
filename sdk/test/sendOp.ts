import { parseEther, toBeHex, Wallet } from 'ethers'
import { ECDSAValidator } from '../accountValidators'
import { addresses } from '../constants'
import { PaymasterProvider } from '../PaymasterProvider'
import { WebWallet } from '../WebWallet'
import { logger } from '../logger'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const CLIENT_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const chainId = 11155111

const wallet = new WebWallet({
	chainId,
	clientUrl: CLIENT_URL,
	bundlerUrl: BUNDLER_URL,
	validators: {
		'eoa-managed': new ECDSAValidator({
			clientUrl: CLIENT_URL,
			signer: new Wallet(PRIVATE_KEY),
			address: addresses.sepolia.ECDSA_VALIDATOR,
		}),
	},
	paymaster: new PaymasterProvider({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses.sepolia.PAYMASTER,
	}),
})

logger.info('Fetching accounts...')
const accounts = await wallet.fetchAccountsByValidator('eoa-managed')

logger.info('Sending op...')
const userOpHash = await wallet.sendOp({
	validatorId: 'eoa-managed',
	from: accounts[1].address,
	executions: [
		{
			to: '0xd78B5013757Ea4A7841811eF770711e6248dC282',
			data: '0x',
			value: toBeHex(parseEther('0.001')),
		},
	],
})

logger.info('Waiting for receipt...')
const receipt = await wallet.waitForOpReceipt(userOpHash)
console.log(receipt)
