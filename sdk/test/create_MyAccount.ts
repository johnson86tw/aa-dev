import type { BytesLike } from 'ethers'
import { toBeHex, Wallet } from 'ethers'
import { addresses } from '../constants'
import { logger } from '../logger'
import { PaymasterProvider } from '../PaymasterProvider'
import { ECDSAValidator } from '../validators/ECDSAValidator'
import { MyAccount } from '../vendors/MyAccount'
import { WebWallet } from '../WebWallet'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const CLIENT_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const chainId = 11155111

const signer = new Wallet(PRIVATE_KEY)

const wallet = new WebWallet({
	chainId,
	clientUrl: CLIENT_URL,
	bundlerUrl: BUNDLER_URL,
	validators: {
		'eoa-managed': new ECDSAValidator({
			clientUrl: CLIENT_URL,
			signer,
			address: addresses.sepolia.ECDSA_VALIDATOR,
		}),
	},
	vendors: {
		'johnson86tw.0.0.1': new MyAccount(),
	},
	paymaster: new PaymasterProvider({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses.sepolia.CHARITY_PAYMASTER,
	}),
})

// generates a random number between 10-99
const salt = toBeHex(Math.floor(Math.random() * (99 - 10 + 1)) + 10)
logger.info(`Salt: ${salt}`)

const createParams: [BytesLike, string, string] = [
	salt, // salt
	addresses.sepolia.ECDSA_VALIDATOR, // validator
	signer.address, // owner
]

const address = await new MyAccount().getAddress(wallet.client, ...createParams)
logger.info(`Address: ${address}`)

const confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

logger.info('Sending op...')
const userOpHash = await wallet.sendOpForAccountCreation(address, 'johnson86tw.0.0.1', 'eoa-managed', createParams)

logger.info('Waiting for receipt...')
const receipt = await wallet.waitForOpReceipt(userOpHash)
console.log(receipt)
