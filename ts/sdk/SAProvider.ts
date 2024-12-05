import type { Signer } from 'ethers'

type ConstructorOptions = {
	chainId: number
	validationModule: string
	signer: Signer
	bundlerUrl: string
	clientUrl: string
	paymaster?: string
}

export class SAProvider {
	constructor(options: ConstructorOptions) {}
}
