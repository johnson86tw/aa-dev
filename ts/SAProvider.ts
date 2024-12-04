import type { BytesLike, PerformActionRequest } from 'ethers'
import { AbstractProvider, Contract, isAddress } from 'ethers'
import { MY_ACCOUNT_FACTORY_ADDRESS } from './sepolia_addresses'

interface SmartAccountInterface {
	init(provider: AbstractProvider): SmartAccountInterface
	getNewAddress(...args: any[]): Promise<string | null>
}

export class MyAccount implements SmartAccountInterface {
	initialized = false
	provider: AbstractProvider | null = null

	init(provider: AbstractProvider) {
		this.provider = provider
		this.initialized = true
		return this
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

export class SAProvider extends AbstractProvider {
	readonly subprovider: AbstractProvider
	readonly account: SmartAccountInterface

	constructor(_provider: AbstractProvider, _account: SmartAccountInterface) {
		super()
		this.subprovider = _provider
		this.account = _account.init(_provider)
	}

	_detectNetwork() {
		return this.subprovider._detectNetwork()
	}

	async _perform<T = any>(req: PerformActionRequest): Promise<T> {
		return await this.subprovider._perform(req)
	}
}
