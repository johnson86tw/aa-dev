import { ethers, hexlify, randomBytes, Wallet } from 'ethers'
import { Bundler, createEntryPoint } from './utils'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY

const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`

const sender = '0x67CE34Bc421060B8594CdD361cE201868845045b' // MyAccount
const ecdsaValidator = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)
const entrypoint = createEntryPoint(provider)
const bundler = new Bundler(BUNDLER_URL)

// ERC-5792
export type SendCallsParams = {
	version: string
	from: `0x${string}`
	calls: {
		to?: `0x${string}` | undefined
		data?: `0x${string}` | undefined
		value?: `0x${string}` | undefined // Hex value
		chainId?: `0x${string}` | undefined // Hex chain id
	}[]
	capabilities?: Record<string, any> | undefined
}

// ERC-5792 GetCallsResult
export type CallsResult = {
	status: 'PENDING' | 'CONFIRMED'
	receipts?: {
		logs: {
			address: `0x${string}`
			data: `0x${string}`
			topics: `0x${string}`[]
		}[]
		status: `0x${string}` // Hex 1 or 0 for success or failure, respectively
		chainId: `0x${string}`
		blockHash: `0x${string}`
		blockNumber: `0x${string}`
		gasUsed: `0x${string}`
		transactionHash: `0x${string}`
	}[]
}

export class WalletService {
	private callStatuses: Map<string, CallsResult> = new Map()

	async sendCalls(params: SendCallsParams): Promise<string> {
		this.validateRequest(params)

		const callId = this.genCallId()

		this.callStatuses.set(callId, {
			status: 'PENDING',
		})

		this.processCalls(callId, params).catch(error => {
			console.error(`Error processing calls for ${callId}:`, error)
		})

		return callId
	}

	async getCallStatus(callId: string): Promise<CallsResult | null> {
		return this.callStatuses.get(callId) || null
	}

	private validateRequest(params: SendCallsParams): void {
		if (!params.from || !params.calls || !Array.isArray(params.calls)) {
			throw new Error('Invalid request format')
		}

		// Validate all calls are on the same chain
		const chainIds = new Set(params.calls.map(call => call.chainId))
		if (chainIds.size > 1) {
			throw new Error('All calls must be on the same chain')
		}
	}

	private async processCalls(callId: string, params: SendCallsParams): Promise<void> {
		try {
			// Build and Send UserOp

			// Update status
			this.callStatuses.set(callId, {
				status: 'CONFIRMED',
				receipts: [],
			})
		} catch (error) {
			console.error(`Failed to process calls for ${callId}:`, error)
			// Update status
			this.callStatuses.set(callId, {
				status: 'CONFIRMED',
				receipts: [],
			})
		}
	}

	private genCallId(): string {
		return hexlify(randomBytes(32))
	}
}
