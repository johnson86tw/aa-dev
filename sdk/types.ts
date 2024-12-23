import { Interface } from 'ethers'
import type { packUserOp } from './utils'
import type { JsonRpcProvider, TransactionReceipt } from 'ethers'

export type RpcRequestArguments = {
	readonly method: string
	readonly params?: readonly unknown[] | object
}

export type PackedUserOperation = {
	sender: string
	nonce: string
	initCode: string
	callData: string
	accountGasLimits: string
	preVerificationGas: string
	gasFees: string
	paymasterAndData: string
	signature: string
}

export type UserOperation = {
	sender: string
	nonce: string
	factory: string | null
	factoryData: string
	callData: string
	callGasLimit: string
	verificationGasLimit: string
	preVerificationGas: string
	maxFeePerGas: string
	maxPriorityFeePerGas: string
	paymaster: string | null
	paymasterVerificationGasLimit: string
	paymasterPostOpGasLimit: string
	paymasterData: string | null
	signature: string
}

export type Log = {
	logIndex: string
	transactionIndex: string
	transactionHash: string
	blockHash: string
	blockNumber: string
	address: string
	data: string
	topics: string[]
}

export type UserOperationReceipt = {
	userOpHash: string
	entryPoint: string
	sender: string
	nonce: string
	paymaster: string
	actualGasUsed: string
	actualGasCost: string
	success: boolean
	logs: Log[]
	receipt: TransactionReceipt
}

export type Execution = {
	to: string
	data: string
	value: string
}

// =============================================== Paymaster ===============================================

export interface PaymasterProvider {
	getPaymasterStubData(params: GetPaymasterStubDataParams): Promise<GetPaymasterStubDataResult>
}

export type GetPaymasterStubDataParams = [
	UserOperation, // userOp
	string, // EntryPoint
	string, // Chain ID
	Record<string, any>, // Context
]

export type GetPaymasterStubDataResult = {
	sponsor?: { name: string; icon?: string } // Sponsor info
	paymaster?: string // Paymaster address (entrypoint v0.7)
	paymasterData?: string // Paymaster data (entrypoint v0.7)
	paymasterVerificationGasLimit?: string // Paymaster validation gas (entrypoint v0.7)
	paymasterPostOpGasLimit?: string // Paymaster post-op gas (entrypoint v0.7)
	paymasterAndData?: string // Paymaster and data (entrypoint v0.6)
	isFinal?: boolean // Indicates that the caller does not need to call pm_getPaymasterData
}

// =============================================== Account Vendor ===============================================

export abstract class AccountVendor {
	static readonly accountId: string
	abstract getNonceKey(validator: string): Promise<string>
	abstract getCallData(from: string, executions: Execution[]): Promise<string>
	abstract getAddress(provider: JsonRpcProvider, ...args: any[]): Promise<string>
	abstract getInitCodeData(...args: any[]): {
		factory: string
		factoryData: string
	}
	abstract getInstallModuleInitData(...args: any[]): Promise<string>
	abstract getUninstallModuleDeInitData(...args: any[]): Promise<string>
}

export interface AccountValidator {
	address(): string
	getDummySignature(): string
	getSignature(userOpHash: string): Promise<string>
	getAccounts(): Promise<string[]>
}

export const ERC7579Interface = new Interface([
	'function installModule(uint256 moduleType, address module, bytes calldata initData)',
	'function uninstallModule(uint256 moduleType, address module, bytes calldata deInitData)',
])
