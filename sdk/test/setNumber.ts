import { Interface, Wallet } from 'ethers'
import { addresses, toNetwork } from '../addresses'
import { logger } from '../logger'
import { PaymasterProvider } from '../PaymasterProvider'
import { ECDSAValidator } from '../validators/ECDSAValidator'
import { Kernel } from '../vendors/Kernel'
import { MyAccount } from '../vendors/MyAccount'
import { WebWallet } from '../WebWallet'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const CLIENT_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const chainId = '11155111'

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
		[Kernel.accountId]: new Kernel(),
	},
	paymaster: new PaymasterProvider({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses[toNetwork(chainId)].CHARITY_PAYMASTER,
	}),
})

logger.info('Fetching accounts...')
const accounts = await wallet.fetchAccountsByValidator('eoa-managed')

accounts.forEach((account, index) => {
	logger.info(`[${index}] ${account.accountId} ${account.address}`)
})

// Prompt for account selection
const selectedIndex = prompt('Select account index:')
if (selectedIndex === null || isNaN(Number(selectedIndex)) || Number(selectedIndex) >= accounts.length) {
	logger.error('Invalid account index')
	process.exit()
}

const sender = accounts[Number(selectedIndex)].address
logger.info('Sender:', sender)

const num = Math.floor(Math.random() * 10000)
logger.info(`Setting number to ${num}`)

logger.info('Sending op...')
const userOpHash = await wallet.sendOp({
	validatorId: 'eoa-managed',
	from: accounts[Number(selectedIndex)].address,
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
console.log(receipt)
