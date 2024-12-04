import type { BytesLike, Signer } from 'ethers'
import { Contract, isAddress } from 'ethers'
import { BundlerProvider } from './BundlerProvider'
import { ECDSA_VALIDATOR_ADDRESS, MY_ACCOUNT_FACTORY_ADDRESS } from './sepolia_addresses'

type SmartAccountConstructor = {
	new (provider: BundlerProvider): SmartAccount
}

interface SmartAccount {}

export class MyAccount implements SmartAccount {
	provider: BundlerProvider | null = null

	constructor(_provider: BundlerProvider) {
		this.provider = _provider
	}

	async getNewAddress(salt: BytesLike, validator: string, owner: string): Promise<string | null> {
		const myAccountFactory = new Contract(
			MY_ACCOUNT_FACTORY_ADDRESS,
			['function getAddress(uint256 salt, address validator, bytes calldata data) public view returns (address)'],
			this.provider,
		)
		const address = await myAccountFactory['getAddress(uint256,address,bytes)'](salt, validator, owner)

		if (!isAddress(address)) {
			return null
		}

		return address
	}
}

type Call = {
	to: string
	data: string
	value: string
}

type SAProviderOptions = {
	clientUrl: string
	bundlerUrl: string
	smartAccount: SmartAccountConstructor
	sender: string
	signer: Signer
}

export class SAProvider extends BundlerProvider {
	readonly ECDSA_VALIDATOR_ADDRESS = ECDSA_VALIDATOR_ADDRESS
	readonly sender: string
	readonly smartAccount: SmartAccount
	readonly signer: SAProviderOptions['signer']

	constructor({ clientUrl, bundlerUrl, smartAccount, sender, signer }: SAProviderOptions) {
		super(clientUrl, bundlerUrl)
		this.sender = sender
		this.smartAccount = new smartAccount(this)
		this.signer = signer
	}

	async sendCalls(calls: Call[]) {}
}
