import { JsonRpcProvider, type Signer } from 'ethers'
import { BundlerRpcProvider } from './BundlerRpcProvider'
import type { Address, RpcRequestArguments } from './types'

type ValidationType = 'ECDSAValidator' | 'WebAuthnValidator'

type ConstructorOptions = {
	chainId: number
	validationType: ValidationType
	signer: Signer
	clientUrl: string
	bundlerUrl: string
	paymaster?: string
}

export class SAProvider {
	#chainId: number
	validationType: ValidationType
	signer: Signer
	client: JsonRpcProvider
	bundler: BundlerRpcProvider

	private accounts: Address[]

	constructor(options: ConstructorOptions) {
		this.#chainId = options.chainId
		this.validationType = options.validationType
		this.signer = options.signer
		this.client = new JsonRpcProvider(options.clientUrl)
		this.bundler = new BundlerRpcProvider(options.bundlerUrl)

		this.accounts = []
	}

	async request(request: RpcRequestArguments) {
		switch (request.method) {
			case 'eth_requestAccounts':
				return this.accounts
			case 'eth_chainId':
				return this.chainId
			case 'wallet_getCapabilities':
			case 'wallet_switchEthereumChain':
			case 'eth_ecRecover':
			case 'personal_sign':
			case 'personal_ecRecover':
			case 'eth_signTransaction':
			case 'eth_sendTransaction':
			case 'eth_signTypedData_v1':
			case 'eth_signTypedData_v3':
			case 'eth_signTypedData_v4':
			case 'eth_signTypedData':
			case 'wallet_addEthereumChain':
			case 'wallet_watchAsset':
			case 'wallet_sendCalls':
			case 'wallet_showCallsStatus':
			case 'wallet_grantPermissions':
			default:
				throw new Error('Invalid method')
		}
	}

	get chainId() {
		// TODO: check if chainId of client and bundler are mismatched with #chainId
		return this.#chainId
	}
}
