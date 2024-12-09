import { Interface, parseEther, toBeHex, Wallet } from 'ethers'
import { ECDSAValidator } from '../accountValidators'
import { addresses, OWNER_ADDRESS } from '../constants'
import { PaymasterProvider } from '../PaymasterProvider'
import { WebWallet } from '../WebWallet'
import { logger } from '../logger'
import { MyAccount } from '../vendors/MyAccount'
import { abiEncode } from '../utils'

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
			address: addresses.sepolia.ECDSA_VALIDATOR,
			clientUrl: CLIENT_URL,
			signer,
		}),
		'eoa-managed-2': new ECDSAValidator({
			address: addresses.sepolia.ECDSA_VALIDATOR_2,
			clientUrl: CLIENT_URL,
			signer,
		}),
	},
	vendors: {
		'johnson86tw.0.0.1': new MyAccount(),
	},
	paymaster: new PaymasterProvider({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses.sepolia.PAYMASTER,
	}),
})

logger.info('Fetching accounts...')
const accounts = await wallet.fetchAccountsByValidator('eoa-managed')
logger.info(`Accounts: ${JSON.stringify(accounts, null, 2)}`)

const sender = accounts[1].address

console.log('Account:', sender)

const validators = await wallet.getValidatorsByAddress(sender, wallet.vendors['johnson86tw.0.0.1'])
console.log('Validators:', validators)
