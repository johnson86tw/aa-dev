import { JsonRpcProvider } from 'ethers'

export class BundlerProvider extends JsonRpcProvider {
	readonly bundlerUrl: string

	constructor(clientUrl: string, bundlerUrl: string) {
		super(clientUrl)
		this.bundlerUrl = bundlerUrl
	}

	// impl bundler rpc methods
}
