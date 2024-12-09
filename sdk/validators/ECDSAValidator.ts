import type { EventLog } from 'ethers'
import { Contract, getBytes, JsonRpcProvider, type Signer } from 'ethers'
import type { AccountValidator } from '../types'

type ConstructorOptions = {
	address: string
	clientUrl: string
	signer: Signer
}

export class ECDSAValidator implements AccountValidator {
	#address: string
	#client: JsonRpcProvider
	#signer: Signer

	#ecdsaValidator: Contract

	constructor(options: ConstructorOptions) {
		this.#address = options.address
		this.#client = new JsonRpcProvider(options.clientUrl)
		this.#signer = options.signer

		this.#ecdsaValidator = new Contract(
			this.#address,
			['event OwnerRegistered(address indexed kernel, address indexed owner)'],
			this.#client,
		)
	}

	address() {
		return this.#address
	}

	getDummySignature() {
		return '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
	}

	async getSignature(userOpHash: string) {
		const signature = await this.#signer.signMessage(getBytes(userOpHash))
		return signature
	}

	async getAccounts(): Promise<string[]> {
		const events = (await this.#ecdsaValidator.queryFilter(
			this.#ecdsaValidator.filters.OwnerRegistered(null, await this.#signer.getAddress()),
		)) as EventLog[]

		return events.map(event => event.args[0])
	}
}
