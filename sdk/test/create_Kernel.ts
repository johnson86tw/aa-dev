import { hexlify, JsonRpcProvider, randomBytes, Wallet } from 'ethers'
import { addresses } from '../addresses'
import { logger } from '../logger'
import { PaymasterProvider } from '../PaymasterProvider'
import { ECDSAValidator } from '../validators/ECDSAValidator'
import { Kernel } from '../vendors/Kernel'
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
		[Kernel.accountId]: new Kernel(),
	},
	paymaster: new PaymasterProvider({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses.sepolia.CHARITY_PAYMASTER,
	}),
})

const salt = hexlify(randomBytes(32))

const address = await new Kernel().getAddress(
	new JsonRpcProvider(CLIENT_URL),
	addresses.sepolia.ECDSA_VALIDATOR,
	signer.address,
	salt,
)
logger.info(`Address: ${address}`)

const confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

logger.info('Sending op...')
const userOpHash = await wallet.sendOpForAccountCreation(address, Kernel.accountId, 'eoa-managed', [
	addresses.sepolia.ECDSA_VALIDATOR,
	signer.address,
	salt,
])

logger.info('Waiting for receipt...')
const receipt = await wallet.waitForOpReceipt(userOpHash)
console.log(receipt)
