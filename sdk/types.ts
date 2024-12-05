import type { packUserOp } from './utils'

export type RpcRequestArguments = {
	readonly method: string
	readonly params?: readonly unknown[] | object
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

export type PackedUserOperation = ReturnType<typeof packUserOp>

export interface Vendor {
	getNonceKey(validator: string): Promise<string>
	getCallData(from: string, calls: Call[]): Promise<string>
}

export interface SmartAccount {
	vendor: Vendor
	signer: {
		signMessage(message: string | Uint8Array): Promise<string>
	}
}

export type Call = {
	to: string
	data: string
	value: string
	chainId?: string
}

// ERC-5792 GetCallsResult
export type CallsResult = {
	status: 'PENDING' | 'CONFIRMED'
	receipts?: {
		logs: {
			address: string
			data: string
			topics: string[]
		}[]
		status: string // Hex 1 or 0 for success or failure, respectively
		chainId: string
		blockHash: string
		blockNumber: string
		gasUsed: string
		transactionHash: string
	}[]
}

// =============================================== Paymaster ===============================================

export interface PaymasterProvider {
	getPaymasterStubData(params: GetPaymasterStubDataParams): Promise<GetPaymasterStubDataResult>
}

export type Paymaster = string | PaymasterProvider | undefined // paymaster url or paymaster provider

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
