import { Interface, Wallet } from 'ethers'
import { ECDSAValidator } from '../validators/ECDSAValidator'
import { addresses } from '../constants'
import { logger } from '../logger'
import { PaymasterProvider } from '../PaymasterProvider'
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

const wallet = new WebWallet({
	chainId,
	clientUrl: CLIENT_URL,
	bundlerUrl: BUNDLER_URL,
	validators: {
		'eoa-managed': new ECDSAValidator({
			address: addresses.sepolia.ECDSA_VALIDATOR,
			clientUrl: CLIENT_URL,
			signer: new Wallet(PRIVATE_KEY),
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
logger.info('Sender:', sender)

const confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

const deInitData = await MyAccount.getUninstallModuleDeInitData(sender, CLIENT_URL, addresses.sepolia.ECDSA_VALIDATOR_2)

logger.info('Sending op...')
const userOpHash = await wallet.sendOp({
	validatorId: 'eoa-managed',
	from: sender,
	executions: [
		{
			to: sender,
			data: new Interface([
				'function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData)',
			]).encodeFunctionData('uninstallModule', [1, addresses.sepolia.ECDSA_VALIDATOR_2, deInitData]),
			value: '0x0',
		},
	],
})

logger.info('Waiting for receipt...')
const receipt = await wallet.waitForOpReceipt(userOpHash)
logger.info(receipt)
