import { Wallet } from 'ethers'
import { beforeEach, describe } from 'vitest'
import { ECDSAValidator } from './accountValidators'
import { MyAccount } from './accountVendors'
import { addresses } from './addresses'
import { PaymasterProvider } from './PaymasterProvider'
import { WebWallet } from './WebWallet'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const CLIENT_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const chainId = 11155111

describe('WebWallet', () => {
	let wallet: WebWallet

	beforeEach(() => {
		wallet = new WebWallet({
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
			vendors: {
				'johnson86tw.0.0.1': new MyAccount(),
			},
			paymaster: new PaymasterProvider({
				chainId,
				clientUrl: CLIENT_URL,
				paymasterAddress: addresses.sepolia.PAYMASTER,
			}),
		})
	})
})
