import { Contract, getBytes, JsonRpcProvider, type Signer } from 'ethers'
import type { EventLog } from 'ethers'
import { addresses } from './constants'

export interface AccountValidator {
	address(): string
	getDummySignature(): string
	getSignature(userOpHash: string): Promise<string>
	getAccounts(): Promise<string[]>
}

type ConstructorOptions = {
	clientUrl: string
	signer: Signer
	address: string
}

export class ECDSAValidator implements AccountValidator {
	#client: JsonRpcProvider
	#signer: Signer
	#address: string

	#ecdsaValidator: Contract

	constructor(options: ConstructorOptions) {
		this.#client = new JsonRpcProvider(options.clientUrl)
		this.#signer = options.signer
		this.#address = options.address

		this.#ecdsaValidator = new Contract(
			addresses.sepolia.ECDSA_VALIDATOR,
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
