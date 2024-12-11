import { hexlify, JsonRpcProvider, randomBytes, toBeHex, Wallet } from 'ethers'
import { addresses, toNetwork } from '../addresses'
import { logger } from '../logger'
import { PaymasterProvider } from '../PaymasterProvider'
import { padLeft } from '../utils'
import { ECDSAValidator } from '../validators/ECDSAValidator'
import { Kernel } from '../vendors/Kernel'
import { WebWallet } from '../WebWallet'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const CLIENT_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY

const defaultChainId = '11155111'
const chainIdInput = prompt('Enter chainId (s for Sepolia, m for Mekong, or custom chainId):')
const chainId =
	chainIdInput === 's' ? defaultChainId : chainIdInput === 'm' ? '7078815900' : chainIdInput || defaultChainId

const defaultSalt = hexlify(randomBytes(32))
const saltInput = prompt('Enter salt (leave empty for random):')
const salt = saltInput ? padLeft(toBeHex(BigInt(saltInput)), 32) : defaultSalt

logger.info(`ChainId: ${chainId}`)
logger.info(`Salt: ${salt}`)

let confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

const BUNDLER_URL = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`

const signer = new Wallet(PRIVATE_KEY)

const wallet = new WebWallet({
	chainId,
	clientUrl: CLIENT_URL,
	bundlerUrl: BUNDLER_URL,
	validators: {
		'eoa-managed': new ECDSAValidator({
			clientUrl: CLIENT_URL,
			signer,
			address: addresses[toNetwork(chainId)].ECDSA_VALIDATOR,
		}),
	},
	vendors: {
		[Kernel.accountId]: new Kernel(),
	},
	paymaster: new PaymasterProvider({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses[toNetwork(chainId)].CHARITY_PAYMASTER,
	}),
})

const address = await new Kernel().getAddress(
	new JsonRpcProvider(CLIENT_URL),
	addresses[toNetwork(chainId)].ECDSA_VALIDATOR,
	signer.address,
	salt,
)
logger.info(`Address: ${address}`)

confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

logger.info('Sending op...')
const userOpHash = await wallet.sendOpForAccountCreation(address, Kernel.accountId, 'eoa-managed', [
	addresses[toNetwork(chainId)].ECDSA_VALIDATOR,
	signer.address,
	salt,
])

logger.info('Waiting for receipt...')
const receipt = await wallet.waitForOpReceipt(userOpHash)
console.log(receipt)
