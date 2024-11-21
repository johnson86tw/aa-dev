import { ethers, hexlify, randomBytes, Wallet } from 'ethers'

import { concat, formatEther, getBytes, Interface, parseEther, toBeHex, zeroPadValue } from 'ethers'

import {
	createEntryPoint,
	ENTRYPOINT,
	fetchUserOpHash,
	getHandleOpsCalldata,
	Bundler,
	type UserOperation,
} from './utils'
if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const BUNDLER_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`
const ecdsaValidator = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)
const entrypoint = createEntryPoint(provider)
const bundler = new Bundler(BUNDLER_URL)

// ERC-5792
export type SendCallsParams = {
	version: string
	from: string
	calls: {
		to?: string | undefined
		data?: string | undefined
		value?: string | undefined // Hex value
		chainId?: string | undefined // Hex chain id
	}[]
	capabilities?: Record<string, any> | undefined
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
			const sender = params.from
			/**
			 * Build callData
			 *
			 * ModeCode:
			 * |--------------------------------------------------------------------|
			 * | CALLTYPE  | EXECTYPE  |   UNUSED   | ModeSelector  |  ModePayload  |
			 * |--------------------------------------------------------------------|
			 * | 1 byte    | 1 byte    |   4 bytes  | 4 bytes       |   22 bytes    |
			 * |--------------------------------------------------------------------|
			 */
			const modeCode = concat([
				'0x00',
				'0x00',
				'0x00000000',
				'0x00000000',
				'0x00000000000000000000000000000000000000000000',
			])

			const executions = params.calls.map(call => ({
				target: call.to || '0x',
				value: BigInt(call.value || '0x0'),
				data: call.data || '0x',
			}))

			// @todo support CALLTYPE_BATCH
			if (executions.length > 1) {
				throw new Error('CALLTYPE_BATCH is not supported yet')
			}

			const execution = executions[0]

			const executionCalldata = concat([
				execution.target,
				zeroPadValue(toBeHex(execution.value), 32),
				execution.data,
			])

			const IMyAccount = new Interface(['function execute(bytes32 mode, bytes calldata executionCalldata)'])
			const callData = IMyAccount.encodeFunctionData('execute', [modeCode, executionCalldata])

			// Build nonce
			const nonceKey = zeroPadValue(ecdsaValidator, 24)
			const nonce = toBeHex(await entrypoint.getNonce(sender, nonceKey))

			// fetch current gas price
			const currentGasPrice = await bundler.request('pimlico_getUserOperationGasPrice')
			const maxFeePerGas = currentGasPrice.standard.maxFeePerGas
			const maxPriorityFeePerGas = currentGasPrice.standard.maxPriorityFeePerGas

			// make sure the length is same as the actual one. it must be set to call eth_estimateUserOperationGas
			const dummySignature =
				'0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'

			const userOp: UserOperation = {
				sender,
				nonce,
				factory: null,
				factoryData: '0x',
				callData,
				callGasLimit: '0x0',
				verificationGasLimit: '0x0',
				preVerificationGas: '0x0',
				maxFeePerGas,
				maxPriorityFeePerGas,
				paymaster: null,
				paymasterVerificationGasLimit: '0x0',
				paymasterPostOpGasLimit: '0x0',
				paymasterData: null,
				signature: dummySignature,
			}

			// estimate gas
			const estimateGas = await bundler.request('eth_estimateUserOperationGas', [userOp, ENTRYPOINT])

			userOp.preVerificationGas = estimateGas.preVerificationGas
			userOp.verificationGasLimit = estimateGas.verificationGasLimit
			userOp.callGasLimit = estimateGas.callGasLimit
			userOp.paymasterVerificationGasLimit = estimateGas.paymasterVerificationGasLimit
			userOp.paymasterPostOpGasLimit = estimateGas.paymasterPostOpGasLimit

			// Sign signature
			const userOpHash = await fetchUserOpHash(userOp, provider)
			console.log('userOpHash', userOpHash)

			console.log('signing userOpHash... by', signer.address)
			const signature = await signer.signMessage(getBytes(userOpHash))

			userOp.signature = signature

			console.log('userOp', userOp)

			const handlesOpsCalldata = getHandleOpsCalldata(userOp, sender)
			console.log('debug:handlesOpsCalldata', handlesOpsCalldata)

			// Get required prefund
			const requiredGas =
				BigInt(userOp.verificationGasLimit) +
				BigInt(userOp.callGasLimit) +
				(BigInt(userOp.paymasterVerificationGasLimit) || 0n) +
				(BigInt(userOp.paymasterPostOpGasLimit) || 0n) +
				BigInt(userOp.preVerificationGas)

			const requiredPrefund = requiredGas * BigInt(userOp.maxFeePerGas)
			console.log('requiredPrefund in ether', formatEther(requiredPrefund))

			const senderBalance = await provider.getBalance(sender)
			console.log('sender balance', formatEther(senderBalance))

			if (senderBalance < requiredPrefund) {
				throw new Error(`Sender address does not have enough native tokens`)
			}

			const res = await bundler.request('eth_sendUserOperation', [userOp, ENTRYPOINT])

			if (res) {
				let result = null
				console.log('Waiting for transaction receipt...')

				while (result === null) {
					result = await bundler.request('eth_getUserOperationReceipt', [userOpHash])

					if (result === null) {
						await new Promise(resolve => setTimeout(resolve, 1000))
						console.log('Waiting for receipt...')
					}
				}

				console.log('Receipt', result)
				console.log('transactionHash', result.receipt.transactionHash)
			} else {
				console.log(res)
			}

			this.callStatuses.set(callId, {
				status: 'CONFIRMED',
				receipts: [],
			})
		} catch (error) {
			console.error(`Failed to process calls for ${callId}:`, error)

			this.callStatuses.set(callId, {
				status: 'CONFIRMED',
			})
		}
	}

	private genCallId(): string {
		return hexlify(randomBytes(32))
	}
}
