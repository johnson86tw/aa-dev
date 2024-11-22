import { ethers, hexlify, randomBytes, Wallet } from 'ethers'
import { concat, getBytes, Interface, toBeHex, zeroPadValue } from 'ethers'
import {
	Bundler,
	createEntryPoint,
	ENTRYPOINT,
	fetchUserOpHash,
	getHandleOpsCalldata,
	type UserOperation,
} from './myAccount/utils'
import { PaymasterService } from './PaymasterService'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.sepolia
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const CHAIN_ID = 11155111
const BUNDLER_URL = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`
const ecdsaValidator = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new Wallet(PRIVATE_KEY, provider)
const entrypoint = createEntryPoint(provider)
const bundler = new Bundler(BUNDLER_URL)

type GetCapabilitiesParams = string[] // Wallet address
type GetCapabilitiesResult = Record<string, Record<string, any>> // Hex chain id

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
	private supportPaymaster: boolean = false

	constructor(options?: { supportPaymaster: boolean }) {
		this.supportPaymaster = options?.supportPaymaster ?? false
	}

	async getCapabilities(params: GetCapabilitiesParams): Promise<GetCapabilitiesResult> {
		if (params[0] === signer.address) {
			return {
				[toBeHex(CHAIN_ID)]: {
					paymasterService: {
						supported: this.supportPaymaster,
					},
				},
			}
		}

		return {}
	}

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
			const callType = params.calls.length > 1 ? '0x01' : '0x00'
			const modeCode = concat([
				callType,
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

			let executionCalldata
			if (callType === '0x01') {
				const abiCoder = new ethers.AbiCoder()
				executionCalldata = abiCoder.encode(
					['tuple(address,uint256,bytes)[]'],
					[executions.map(execution => [execution.target, execution.value, execution.data])],
				)
			} else {
				executionCalldata = concat([
					executions[0].target,
					zeroPadValue(toBeHex(executions[0].value), 32),
					executions[0].data,
				])
			}

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

			if (this.supportPaymaster) {
				const paymasterService = new PaymasterService()
				const paymasterResult = await paymasterService.getPaymasterStubData([
					{
						sender: userOp.sender,
						nonce: userOp.nonce,
						initCode: '0x',
						callData: userOp.callData,
						callGasLimit: userOp.callGasLimit,
						verificationGasLimit: userOp.verificationGasLimit,
						preVerificationGas: userOp.preVerificationGas,
						maxFeePerGas: userOp.maxFeePerGas,
						maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
					},
					ENTRYPOINT,
					CHAIN_ID.toString(),
					{}, // Context
				])

				userOp.paymaster = paymasterResult.paymaster || null
				userOp.paymasterData = paymasterResult.paymasterData || null
				userOp.paymasterVerificationGasLimit = paymasterResult.paymasterVerificationGasLimit || '0x0'
				userOp.paymasterPostOpGasLimit = paymasterResult.paymasterPostOpGasLimit || '0x0'
			}

			// estimate gas
			const estimateGas = await bundler.request('eth_estimateUserOperationGas', [userOp, ENTRYPOINT])

			userOp.preVerificationGas = estimateGas.preVerificationGas
			userOp.verificationGasLimit = estimateGas.verificationGasLimit
			userOp.callGasLimit = estimateGas.callGasLimit
			userOp.paymasterVerificationGasLimit = estimateGas.paymasterVerificationGasLimit
			userOp.paymasterPostOpGasLimit = estimateGas.paymasterPostOpGasLimit

			// console.log('userOp', userOp)

			// Sign signature
			const userOpHash = await fetchUserOpHash(userOp, provider)
			// console.log('userOpHash', userOpHash)

			// console.log('signing userOpHash... by', signer.address)
			const signature = await signer.signMessage(getBytes(userOpHash))

			userOp.signature = signature

			// console.log('userOp', userOp)

			const handlesOpsCalldata = getHandleOpsCalldata(userOp, sender)
			// console.log('debug:handlesOpsCalldata', handlesOpsCalldata)

			// Get required prefund
			const requiredGas =
				BigInt(userOp.verificationGasLimit) +
				BigInt(userOp.callGasLimit) +
				(BigInt(userOp.paymasterVerificationGasLimit) || 0n) +
				(BigInt(userOp.paymasterPostOpGasLimit) || 0n) +
				BigInt(userOp.preVerificationGas)

			const requiredPrefund = requiredGas * BigInt(userOp.maxFeePerGas)

			if (!this.supportPaymaster) {
				const senderBalance = await provider.getBalance(sender)

				if (senderBalance < requiredPrefund) {
					throw new Error(`Sender address does not have enough native tokens`)
				}
			} else {
				// @todo if support paymaster, check balance of paymaster
			}

			console.log('Sending UserOp...')
			const res = await bundler.request('eth_sendUserOperation', [userOp, ENTRYPOINT])
			if (!res) {
				throw new Error('Failed to send user operation')
			}

			console.log('Waiting for receipt...')

			let result = null
			while (result === null) {
				result = await bundler.request('eth_getUserOperationReceipt', [userOpHash])

				if (result === null) {
					await new Promise(resolve => setTimeout(resolve, 1000))
					console.log('Waiting for receipt...')
				}
			}

			console.log('UserOp Receipt', result)

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
						chainId: CHAIN_ID.toString(),
						blockHash: result.receipt.blockHash,
						blockNumber: result.receipt.blockNumber,
						gasUsed: result.receipt.gasUsed,
						transactionHash: result.receipt.transactionHash,
					},
				],
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
