import type { BytesLike } from 'ethers'
import { Contract, isAddress } from 'ethers'
import { BundlerProvider } from '../BundlerProvider'
import { addresses } from './constants'

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
			addresses.sepolia.MY_ACCOUNT_FACTORY,
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
