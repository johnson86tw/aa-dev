import { Contract, JsonRpcProvider, toBeHex } from 'ethers'
import { type AccountValidator } from './accountValidators'
import { type AccountVendor } from './accountVendors'
import { BundlerRpcProvider } from './BundlerRpcProvider'
import { addresses } from './constants'
import type { Execution, PaymasterProvider, UserOperation, UserOperationReceipt } from './types'
import { getEmptyUserOp, packUserOp } from './utils'

type ConstructorOptions = {
	chainId: number
	clientUrl: string
	bundlerUrl: string
	validators: {
		[key: string]: AccountValidator
	}
	vendors: {
		[key: string]: AccountVendor
	}
	paymaster?: PaymasterProvider
}

type Account = {
	[address: string]: string
}

export class WebWallet {
	static readonly ENTRYPOINT_VERSION = 'v0.7'
	readonly entryPoint: Contract

	chainId: number
	client: JsonRpcProvider
	bundler: BundlerRpcProvider
	validators: {
		[key: string]: AccountValidator
	}
	vendors: {
		[accountId: string]: AccountVendor
	}
	paymaster?: PaymasterProvider

	accounts: Account = {}

	constructor(options: ConstructorOptions) {
		this.chainId = options.chainId
		this.client = new JsonRpcProvider(options.clientUrl)
		this.bundler = new BundlerRpcProvider(options.bundlerUrl)
		this.validators = options.validators
		this.vendors = options.vendors
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

	get isPaymasterSupported() {
		return this.paymaster !== undefined
	}

	get getAccounts() {
		return Object.keys(this.accounts)
	}

	async fetchAccountsByValidator(validatorId: string): Promise<
		{
			address: string
			accountId: string
		}[]
	> {
		const accounts = await this.validators[validatorId].getAccounts()
		const res: {
			address: string
			accountId: string
		}[] = []
		for (const address of accounts) {
			const sa = new Contract(
				address,
				['function accountId() external pure returns (string memory)'],
				this.client,
			)
			const accountId = await sa.accountId()
			res.push({
				address,
				accountId,
			})
		}

		this.accounts = res.reduce((acc, cur) => {
			acc[cur.address] = cur.accountId
			return acc
		}, {} as Account)

		return res
	}

	async sendOp(params: {
		validatorId: string
		from: string
		executions: Execution[]
		capabilities?: Record<string, any> | undefined
	}): Promise<string> {
		// TODO: check if from is in the accounts

		const { validatorId, from, executions } = params

		const { userOp, userOpHash } = await this.buildUserOp(validatorId, from, executions)

		await this.bundler.send({
			method: 'eth_sendUserOperation',
			params: [userOp, addresses.sepolia.ENTRY_POINT],
		})

		return userOpHash
	}

	async waitForOpReceipt(userOpHash: string): Promise<UserOperationReceipt> {
		let result: UserOperationReceipt | null = null
		while (result === null) {
			result = await this.bundler.send({ method: 'eth_getUserOperationReceipt', params: [userOpHash] })
			if (result === null) {
				await new Promise(resolve => setTimeout(resolve, 1000))
			}
		}
		return result
	}

	private async buildUserOp(
		validatorId: string,
		from: string,
		executions: Execution[],
	): Promise<{
		userOp: UserOperation
		userOpHash: string
	}> {
		const userOp = getEmptyUserOp()
		userOp.sender = from
		userOp.nonce = await this.getNonce(validatorId, from)
		userOp.callData = await this.getCallData(from, executions)

		userOp.signature = this.validators[validatorId].getDummySignature()

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
		// TODO: calculate userOpHash without requesting from entryPoint
		const userOpHash = await this.entryPoint.getUserOpHash(packUserOp(userOp))
		userOp.signature = await this.getSignature(validatorId, userOpHash)

		return {
			userOp,
			userOpHash,
		}
	}

	getVendorByAddress(address: string) {
		const accountId = this.accounts[address]
		const vendor = this.vendors[accountId]
		if (!vendor) {
			throw new Error(`Vendor not found for account ${accountId}`)
		}
		return vendor
	}

	private async getNonce(validatorId: string, from: string): Promise<string> {
		const vendor = this.getVendorByAddress(from)
		const nonceKey = await vendor.getNonceKey(this.validators[validatorId].address())
		const nonce: bigint = await this.entryPoint.getNonce(from, nonceKey)
		return toBeHex(nonce)
	}

	private async getCallData(from: string, executions: Execution[]) {
		const vendor = this.getVendorByAddress(from)
		return await vendor.getCallData(from, executions)
	}

	private async getSignature(validatorId: string, userOpHash: string) {
		const signature = await this.validators[validatorId].getSignature(userOpHash)
		return signature
	}

	private async getPaymasterInfo(userOp: UserOperation) {
		if (typeof this.paymaster === 'object') {
			const paymasterProvider = this.paymaster as PaymasterProvider
			const paymasterResult = await paymasterProvider.getPaymasterStubData([
				userOp,
				addresses.sepolia.ENTRY_POINT,
				this.chainId.toString(),
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
		// Note: user operation max fee per gas must be larger than 0 during gas estimation
		userOp.maxFeePerGas = curGasPrice.standard.maxFeePerGas
		const estimateGas = await this.bundler.send({
			method: 'eth_estimateUserOperationGas',
			params: [userOp, addresses.sepolia.ENTRY_POINT],
		})

		return {
			maxFeePerGas: userOp.maxFeePerGas,
			maxPriorityFeePerGas: curGasPrice.standard.maxPriorityFeePerGas,
			preVerificationGas: estimateGas.preVerificationGas,
			verificationGasLimit: estimateGas.verificationGasLimit,
			callGasLimit: estimateGas.callGasLimit,
			paymasterVerificationGasLimit: estimateGas.paymasterVerificationGasLimit,
			paymasterPostOpGasLimit: estimateGas.paymasterPostOpGasLimit,
		}
	}
}
