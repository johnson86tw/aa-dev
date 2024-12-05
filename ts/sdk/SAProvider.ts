import { hexlify, JsonRpcProvider, randomBytes, toBeHex } from 'ethers'
import { BundlerRpcProvider } from './BundlerRpcProvider'
import type {
	Address,
	Call,
	CallsResult,
	GetPaymasterStubDataParams,
	GetPaymasterStubDataResult,
	RpcRequestArguments,
} from './types'

type ValidationType = 'ECDSAValidator' | 'WebAuthnValidator'

interface MySigner {
	signMessage(message: string | Uint8Array): Promise<string>
}

interface PaymasterProvider {
	getPaymasterStubData(params: GetPaymasterStubDataParams): Promise<GetPaymasterStubDataResult>
}

type Paymaster = string | PaymasterProvider | undefined // paymaster url or paymaster provider

type ConstructorOptions = {
	chainId: number
	validationType: ValidationType
	signer: MySigner
	clientUrl: string
	bundlerUrl: string
	paymaster?: Paymaster
}

export class SAProvider {
	// constructor options
	#chainId: number
	validationType: ValidationType
	signer: MySigner
	client: JsonRpcProvider
	bundler: BundlerRpcProvider
	paymaster?: Paymaster

	// internal state
	private accounts: Address[] = []
	private callStatuses: Map<string, CallsResult> = new Map()
	sender: Address | null = null

	constructor(options: ConstructorOptions) {
		this.#chainId = options.chainId
		this.validationType = options.validationType
		this.signer = options.signer
		this.client = new JsonRpcProvider(options.clientUrl)
		this.bundler = new BundlerRpcProvider(options.bundlerUrl)
		this.paymaster = options.paymaster
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
		// TODO: check if the client and bundler chainIds mismatch with #chainId
		return this.#chainId
	}

	get isPaymasterSupported() {
		return this.paymaster !== undefined
	}

	setSender(address: Address) {
		this.sender = address
	}

	async getCapabilities(params: string[]): Promise<Record<string, Record<string, any>>> {
		// TODO: get capabilities for specific address
		return {
			[toBeHex(this.#chainId)]: {
				paymasterService: {
					supported: this.isPaymasterSupported,
				},
			},
		}
	}

	async sendCalls(params: {
		version: string
		from: string
		calls: Call[]
		capabilities?: Record<string, any> | undefined
	}): Promise<string> {
		this.checkCallParams(params)

		const callId = this.genCallId()

		this.callStatuses.set(callId, {
			status: 'PENDING',
		})

		// TODO: process calls

		return callId
	}

	/**
	 * Validate all calls are on the same chain
	 * @param params
	 */
	private checkCallParams(params: { version: string; from: string; calls: Call[] }) {
		if (!params.from || !params.calls || !Array.isArray(params.calls)) {
			throw new Error('Invalid request format')
		}

		const chainIds = new Set(params.calls.map(call => call.chainId))
		if (chainIds.size > 1) {
			throw new Error('All calls must be on the same chain')
		}
	}

	private genCallId(): string {
		return hexlify(randomBytes(32))
	}

	private async getCallStatus(callId: string): Promise<CallsResult | null> {
		return this.callStatuses.get(callId) || null
	}

	private async waitForReceipts(callId: string): Promise<CallsResult['receipts']> {
		let result: CallsResult | null = null

		while (!result || result.status === 'PENDING') {
			result = await this.getCallStatus(callId)

			if (!result || result.status === 'PENDING') {
				await new Promise(resolve => setTimeout(resolve, 1000))
			}
		}

		if (result.status === 'CONFIRMED' && result?.receipts) {
			return result.receipts
		}

		throw new Error('No receipts found')
	}
}
