import type { EventLog } from 'ethers'
import { Contract, JsonRpcProvider, toBeHex } from 'ethers'
import { BundlerRpcProvider } from './BundlerRpcProvider'
import { addresses, toNetwork } from './addresses'
import type { Execution, PaymasterProvider, UserOperation, UserOperationReceipt } from './types'
import { type AccountValidator, type AccountVendor } from './types'
import { getEmptyUserOp, getUserOpHash, packUserOp } from './utils'

type ConstructorOptions = {
	chainId: string
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

type AccountInfo = {
	address: string
	accountId: string
}

export class WebWallet {
	static readonly ENTRYPOINT_VERSION = 'v0.7'
	readonly entryPoint: Contract

	chainId: string
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
			addresses[toNetwork(this.chainId)].ENTRY_POINT,
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

	async sendOpForAccountCreation(address: string, accountId: string, validatorId: string, createParams: any[]) {
		const vendor = this.vendors[accountId]

		const sender = await vendor.getAddress(this.client, ...createParams)
		if (address !== sender) {
			throw new Error('Sender address mismatch')
		}

		const { factory, factoryData } = vendor.getInitCodeData(...createParams)

		const userOp = getEmptyUserOp()
		userOp.sender = address
		userOp.nonce = await this.getNonce(vendor, validatorId, address)
		userOp.factory = factory
		userOp.factoryData = factoryData
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
		const userOpHash = getUserOpHash(this.chainId, packUserOp(userOp))
		userOp.signature = await this.getSignature(validatorId, userOpHash)

		await this.bundler.send({
			method: 'eth_sendUserOperation',
			params: [userOp, addresses[toNetwork(this.chainId)].ENTRY_POINT],
		})

		return userOpHash
	}

	async fetchAccountsByValidator(validatorId: string): Promise<AccountInfo[]> {
		const validator = this.validators[validatorId]
		if (!validator) {
			throw new Error(`Validator not found`)
		}

		const accounts = await validator.getAccounts()
		const res: AccountInfo[] = []

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
			params: [userOp, addresses[toNetwork(this.chainId)].ENTRY_POINT],
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

		const vendor = this.getVendorByAddress(from)
		if (!vendor) {
			throw new Error(`Vendor not found`)
		}

		userOp.nonce = await this.getNonce(vendor, validatorId, from)
		userOp.callData = await this.getCallData(vendor, from, executions)

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
		const userOpHash = getUserOpHash(this.chainId, packUserOp(userOp))
		userOp.signature = await this.getSignature(validatorId, userOpHash)

		return {
			userOp,
			userOpHash,
		}
	}

	getVendorByAddress(address: string): AccountVendor | null {
		const accountId = this.accounts[address]
		const vendor = this.vendors[accountId]
		if (!vendor) {
			return null
		}
		return vendor
	}

	async getValidatorsByAccount(address: string, _vendor?: AccountVendor): Promise<string[]> {
		const vendor = _vendor || this.getVendorByAddress(address)
		if (!vendor) {
			throw new Error(`Vendor not found`)
		}

		const contract = new Contract(
			address,
			[
				'event ModuleInstalled(uint256 moduleTypeId, address module)',
				'event ModuleUninstalled(uint256 moduleTypeId, address module)',
			],
			this.client,
		)

		// Get all install/uninstall events
		const installEvents = (await contract.queryFilter(contract.filters.ModuleInstalled)) as EventLog[]
		const uninstallEvents = (await contract.queryFilter(contract.filters.ModuleUninstalled)) as EventLog[]

		// Track installed modules
		const installedModules = new Set<string>()

		// Process events in chronological order
		const allEvents = [...installEvents, ...uninstallEvents].sort((a, b) => {
			if (a.blockNumber !== b.blockNumber) {
				return a.blockNumber - b.blockNumber
			}
			return a.transactionIndex - b.transactionIndex
		})

		// Update tracking of installed modules (only for type 1 - validators)
		for (const event of allEvents) {
			const { moduleTypeId, module } = event.args
			if (moduleTypeId.toString() === '1') {
				if (event.fragment.name === 'ModuleInstalled') {
					installedModules.add(module)
				} else {
					installedModules.delete(module)
				}
			}
		}

		return Array.from(installedModules)
	}

	private async getNonce(vendor: AccountVendor, validatorId: string, from: string): Promise<string> {
		const nonceKey = await vendor.getNonceKey(this.validators[validatorId].address())
		const nonce: bigint = await this.entryPoint.getNonce(from, nonceKey)
		return toBeHex(nonce)
	}

	private async getCallData(vendor: AccountVendor, from: string, executions: Execution[]) {
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
				addresses[toNetwork(this.chainId)].ENTRY_POINT,
				this.chainId,
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
			params: [userOp, addresses[toNetwork(this.chainId)].ENTRY_POINT],
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
