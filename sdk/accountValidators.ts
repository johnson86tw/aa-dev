import { getBytes, type Signer } from 'ethers'

export interface AccountValidator {
	address(): string
	getSignature(userOpHash: string): Promise<string>
}

export class ECDSAValidator implements AccountValidator {
	#signer: Signer
	#address: string

	constructor(signer: Signer, address: string) {
		this.#signer = signer
		this.#address = address
	}

	address() {
		return this.#address
	}

	async getSignature(userOpHash: string) {
		const signature = await this.#signer.signMessage(getBytes(userOpHash))
		return signature
	}
}
