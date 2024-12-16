import { Interface, toNumber, Wallet } from 'ethers'
import { addresses, toNetwork } from '../addresses'
import { logger } from '../logger'
import { PaymasterProvider } from '../PaymasterProvider'
import { ECDSAValidator } from '../validators/ECDSAValidator'
import { Kernel } from '../vendors/Kernel'
import { MyAccount } from '../vendors/MyAccount'
import { WebWallet } from '../WebWallet'
import { askForSender, setup } from './common'
import { WebAuthnValidator } from '../validators/WebAuthnValidator'

const { chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup()

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
		passkey: new WebAuthnValidator({
			address: addresses[toNetwork(chainId)].WEB_AUTHN_VALIDATOR,
		}),
	},
	vendors: {
		'johnson86tw.0.0.1': new MyAccount(),
		[Kernel.accountId]: new Kernel(),
	},
	paymaster: new PaymasterProvider({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses[toNetwork(chainId)].CHARITY_PAYMASTER,
	}),
})

const sender = await askForSender(wallet, 'eoa-managed')

const num = Math.floor(Math.random() * 10000)
logger.info(`Setting number to ${num}`)

logger.info('Sending op...')
const userOpHash = await wallet.sendOp({
	validatorId: 'passkey',
	from: sender,
	executions: [
		{
			to: addresses[toNetwork(chainId)].COUNTER,
			data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [num]),
			value: '0x0',
		},
	],
})

logger.info('Waiting for receipt...')
const receipt = await wallet.waitForOpReceipt(userOpHash)
logger.info(receipt)

if (receipt.logs.length > 0) {
	const log = receipt.logs[receipt.logs.length - 1]
	logger.info(toNumber(log.data))
}
