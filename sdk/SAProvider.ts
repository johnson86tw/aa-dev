import { Contract, hexlify, JsonRpcProvider, randomBytes, toBeHex } from 'ethers'
import type { AccountValidator } from './accountValidators'
import type { AccountVendor } from './accountVendors'
import { BundlerRpcProvider } from './BundlerRpcProvider'
import { addresses } from './constants'
import type { Call, CallsResult, Paymaster, PaymasterProvider, RpcRequestArguments, UserOperation } from './types'
import { getEmptyUserOp, packUserOp } from './utils'
import { logger } from './logger'

type ConstructorOptions = {
	chainId: number
	validator: AccountValidator
	vendor: AccountVendor
	clientUrl: string
	bundlerUrl: string
	paymaster?: Paymaster
}

export class SAProvider {
	// constructor options
	#chainId: number
	validator: AccountValidator
	vendor: AccountVendor
	client: JsonRpcProvider
	bundler: BundlerRpcProvider
	paymaster?: Paymaster

	// internal state
	private accounts: string[] = []
	private callStatuses: Map<string, CallsResult> = new Map()

	private entryPoint: Contract
	sender: string | null = null

	constructor(options: ConstructorOptions) {
		this.#chainId = options.chainId
		this.validator = options.validator
		this.vendor = options.vendor
		this.client = new JsonRpcProvider(options.clientUrl)
		this.bundler = new BundlerRpcProvider(options.bundlerUrl)
		this.paymaster = options.paymaster

		this.entryPoint = new Contract(
			addresses.sepolia.ENTRY_POINT,
			[
				'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
				'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
				'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external',
			],
			this.client,
		)
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

	async requestAccounts() {
		return await this.validator.getAccounts()
	}

	get chainId(): number {
		// TODO: check if the client and bundler chainIds mismatch with #chainId
		return this.#chainId
	}

	get isPaymasterSupported() {
		return this.paymaster !== undefined
	}

	setSender(address: string) {
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

	async getCallStatus(callId: string): Promise<CallsResult | null> {
		return this.callStatuses.get(callId) || null
	}

	async sendCalls(params: {
		version: string
		from: string
		calls: Call[]
		capabilities?: Record<string, any> | undefined
	}): Promise<string> {
		logger.info('Sending calls...')

		this.checkCallParams(params) // TODO: check if from is in the accounts
		const { from, calls } = params
		const callId = this.genCallId()

		this.callStatuses.set(callId, {
			status: 'PENDING',
		})

		logger.info('Building user operation...')
		const { userOp, userOpHash } = await this.buildUserOp(from, calls)

		logger.info('Sending user operation...')
		const res = await this.bundler.send({
			method: 'eth_sendUserOperation',
			params: [userOp, addresses.sepolia.ENTRY_POINT],
		})

		if (!res) {
			this.callStatuses.set(callId, {
				status: 'CONFIRMED',
			})
			return callId
		}

		let result = null
		while (result === null) {
			result = await this.bundler.send({ method: 'eth_getUserOperationReceipt', params: [userOpHash] })
			if (result === null) {
				await new Promise(resolve => setTimeout(resolve, 1000))
				console.log('Waiting for receipt...')
			}
		}

		this.callStatuses.set(callId, {
			status: 'CONFIRMED',
			receipts: [
				{
					logs: result.logs.map((log: any) => ({
						address: log.address,
						data: log.data,
						topics: log.topics,
					})),
					status: result.success ? '0x1' : '0x0',
					chainId: this.#chainId.toString(),
					blockHash: result.receipt.blockHash,
					blockNumber: result.receipt.blockNumber,
					gasUsed: result.receipt.gasUsed,
					transactionHash: result.receipt.transactionHash,
				},
			],
		})

		return callId
	}

	async waitForReceipts(callId: string): Promise<CallsResult['receipts']> {
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

	private async buildUserOp(
		from: string,
		calls: Call[],
	): Promise<{
		userOp: UserOperation
		userOpHash: string
	}> {
		const userOp = getEmptyUserOp()
		userOp.sender = from
		userOp.nonce = await this.getNonce(from)
		userOp.callData = await this.getCallData(from, calls)

		userOp.signature = this.validator.getDummySignature()

		if (this.isPaymasterSupported) {
			const paymasterInfo = await this.getPaymasterInfo(userOp)
			userOp.paymaster = paymasterInfo.paymaster
			userOp.paymasterData = paymasterInfo.paymasterData
			userOp.paymasterVerificationGasLimit = paymasterInfo.paymasterVerificationGasLimit
			userOp.paymasterPostOpGasLimit = paymasterInfo.paymasterPostOpGasLimit
		}

		const gasValues = await this.getGasValues(userOp)
		userOp.maxFeePerGas = gasValues.maxFeePerGas
		userOp.maxPriorityFeePerGas = gasValues.maxPriorityFeePerGas
		userOp.preVerificationGas = gasValues.preVerificationGas
		userOp.verificationGasLimit = gasValues.verificationGasLimit
		userOp.callGasLimit = gasValues.callGasLimit
		userOp.paymasterVerificationGasLimit = gasValues.paymasterVerificationGasLimit
		userOp.paymasterPostOpGasLimit = gasValues.paymasterPostOpGasLimit

		// Sign signature
		const userOpHash = await this.entryPoint.getUserOpHash(packUserOp(userOp))
		userOp.signature = await this.getSignature(userOpHash)

		return {
			userOp,
			userOpHash,
		}
	}

	private async getNonce(sender: string): Promise<string> {
		const nonceKey = await this.vendor.getNonceKey(this.validator.address())
		return await this.entryPoint.getNonce(sender, nonceKey)
	}

	private async getCallData(from: string, calls: Call[]) {
		return await this.vendor.getCallData(from, calls)
	}

	private async getSignature(userOpHash: string) {
		const signature = await this.validator.getSignature(userOpHash)
		return signature
	}

	private async getPaymasterInfo(userOp: UserOperation) {
		if (typeof this.paymaster === 'object') {
			const paymasterProvider = this.paymaster as PaymasterProvider
			const paymasterResult = await paymasterProvider.getPaymasterStubData([
				userOp,
				addresses.sepolia.ENTRY_POINT,
				this.#chainId.toString(),
				{}, // Context
			])

			return {
				paymaster: paymasterResult.paymaster || null,
				paymasterData: paymasterResult.paymasterData || null,
				paymasterVerificationGasLimit: paymasterResult.paymasterVerificationGasLimit || '0x0',
				paymasterPostOpGasLimit: paymasterResult.paymasterPostOpGasLimit || '0x0',
			}
		} else {
			// TODO: support paymaster url
			throw new Error('Paymaster not supported', { cause: this.paymaster })
		}
	}

	private async getGasValues(userOp: UserOperation) {
		const curGasPrice = await this.bundler.send({ method: 'pimlico_getUserOperationGasPrice' })
		const estimateGas = await this.bundler.send({
			method: 'eth_estimateUserOperationGas',
			params: [userOp, addresses.sepolia.ENTRY_POINT],
		})

		return {
			maxFeePerGas: curGasPrice.standard.maxFeePerGas,
			maxPriorityFeePerGas: curGasPrice.standard.maxPriorityFeePerGas,
			preVerificationGas: estimateGas.preVerificationGas,
			verificationGasLimit: estimateGas.verificationGasLimit,
			callGasLimit: estimateGas.callGasLimit,
			paymasterVerificationGasLimit: estimateGas.paymasterVerificationGasLimit,
			paymasterPostOpGasLimit: estimateGas.paymasterPostOpGasLimit,
		}
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
}
