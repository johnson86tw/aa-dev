import { Interface, Wallet } from 'ethers'
import { addresses, toNetwork } from '../addresses'
import { logger } from '../logger'
import { PaymasterProvider } from '../PaymasterProvider'
import { abiEncode } from '../utils'
import { ECDSAValidator } from '../validators/ECDSAValidator'
import { MyAccount } from '../vendors/MyAccount'
import { WebWallet } from '../WebWallet'
import { askForChainId, askForSender, getEnv } from './common'

const { PRIVATE_KEY, ALCHEMY_API_KEY, PIMLICO_API_KEY } = getEnv()

const chainId = askForChainId()

const CLIENT_URL = `https://eth-${toNetwork(chainId)}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
const BUNDLER_URL = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`

const wallet = new WebWallet({
	chainId,
	clientUrl: CLIENT_URL,
	bundlerUrl: BUNDLER_URL,
	validators: {
		'eoa-managed': new ECDSAValidator({
			clientUrl: CLIENT_URL,
			signer: new Wallet(PRIVATE_KEY),
			address: addresses[toNetwork(chainId)].ECDSA_VALIDATOR,
		}),
	},
	vendors: {
		'johnson86tw.0.0.1': new MyAccount(),
	},
	paymaster: new PaymasterProvider({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses[toNetwork(chainId)].PAYMASTER,
	}),
})

const sender = await askForSender(wallet, 'eoa-managed')

// Build initData

const pubKeyX = prompt('Enter pubKeyX:')
const pubKeyY = prompt('Enter pubKeyY:')
const authenticatorIdHash = prompt('Enter authenticatorIdHash:')

const initData = abiEncode(
	[
		'tuple(uint256 pubKeyX, uint256 pubKeyY)', // WebAuthnValidatorData
		'bytes32', // authenticatorIdHash
	],
	[{ pubKeyX, pubKeyY }, authenticatorIdHash],
)

logger.info(`Init data: ${initData}`)

const confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

logger.info('Sending op...')
const userOpHash = await wallet.sendOp({
	validatorId: 'eoa-managed',
	from: sender,
	executions: [
		{
			to: sender,
			data: new Interface([
				'function installModule(uint256 moduleTypeId, address module, bytes calldata initData)',
			]).encodeFunctionData('installModule', [1, addresses[toNetwork(chainId)].WEB_AUTHN_VALIDATOR, initData]),
			value: '0x0',
		},
	],
})

logger.info('Waiting for receipt...')
const receipt = await wallet.waitForOpReceipt(userOpHash)
logger.info(receipt)