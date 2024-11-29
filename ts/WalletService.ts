import { concat, ethers, getBytes, hexlify, Interface, randomBytes, toBeHex, Wallet, zeroPadValue } from 'ethers'
import {
	isEnableMode,
	SMART_SESSION_ADDRESS,
	SMART_SESSIONS_USE_MODE,
	type SmartSessionsMode,
} from './myAccount/scheduled_transfer/utils'
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
const ECDSA_VALIDATOR_ADDRESS = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'

const provider = new ethers.JsonRpcProvider(RPC_URL)

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

type UseSmartSessions = {
	privateKey: string
	mode: SmartSessionsMode
	permissionId?: string // 32 bytes
}

export class WalletService {
	private callStatuses: Map<string, CallsResult> = new Map()
	private supportPaymaster: boolean = false
	private signer: Wallet
	private useSmartSessions: UseSmartSessions | undefined

	constructor(options?: { supportPaymaster: boolean; useSmartSessions?: UseSmartSessions }) {
		this.supportPaymaster = options?.supportPaymaster ?? false
		this.signer = new Wallet(options?.useSmartSessions?.privateKey ?? PRIVATE_KEY, provider)
		this.useSmartSessions = options?.useSmartSessions ?? undefined
	}

	async getCapabilities(params: GetCapabilitiesParams): Promise<GetCapabilitiesResult> {
		if (params[0] === this.signer.address) {
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
		let userOp: UserOperation | undefined
		const sender = params.from
		const calls = params.calls

		try {
			let callData
			// if one of the call is to SA itself, it must be a single call
			if (calls.some(call => call.to === sender)) {
				if (calls.length > 1) {
					throw new Error('If one of the call is to SA itself, it must be a single call')
				}

				callData = calls[0].data
			} else {
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
					// batch execution
					executionCalldata = new ethers.AbiCoder().encode(
						['tuple(address,uint256,bytes)[]'],
						[executions.map(execution => [execution.target, execution.value, execution.data])],
					)
				} else {
					// single execution
					executionCalldata = concat([
						executions[0].target,
						zeroPadValue(toBeHex(executions[0].value), 32),
						executions[0].data,
					])
				}

				const IMyAccount = new Interface(['function execute(bytes32 mode, bytes calldata executionCalldata)'])
				callData = IMyAccount.encodeFunctionData('execute', [modeCode, executionCalldata])
				console.log('callData', callData)
			}

			if (!callData) {
				throw new Error('Failed to build callData')
			}

			// Build nonce
			let nonceKey
			if (this.useSmartSessions) {
				nonceKey = zeroPadValue(SMART_SESSION_ADDRESS, 24)
			} else {
				nonceKey = zeroPadValue(ECDSA_VALIDATOR_ADDRESS, 24)
			}
			const nonce = toBeHex(await entrypoint.getNonce(sender, nonceKey))

			// fetch current gas price
			const currentGasPrice = await bundler.request('pimlico_getUserOperationGasPrice')
			const maxFeePerGas = currentGasPrice.standard.maxFeePerGas
			const maxPriorityFeePerGas = currentGasPrice.standard.maxPriorityFeePerGas

			// make sure the length is same as the actual one. it must be set to call eth_estimateUserOperationGas
			userOp = {
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
				signature: '0x',
			}

			let dummySignature
			if (this.useSmartSessions) {
				const dummyPackedSignature =
					'0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'

				if (isEnableMode(this.useSmartSessions.mode)) {
					dummySignature = concat([this.useSmartSessions.mode, dummyPackedSignature])
				} else {
					if (!this.useSmartSessions.permissionId) {
						throw new Error('USE mode must have permissionId')
					}
					dummySignature = concat([
						SMART_SESSIONS_USE_MODE,
						this.useSmartSessions.permissionId,
						dummyPackedSignature,
					])
				}
			} else {
				dummySignature =
					'0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
			}

			userOp.signature = dummySignature

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

			console.log('userOp', userOp)

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
			const signature = await this.signer.signMessage(getBytes(userOpHash))

			if (this.useSmartSessions) {
				console.log('smartsessions signer', this.signer.address)
				if (isEnableMode(this.useSmartSessions.mode)) {
					userOp.signature = concat([this.useSmartSessions.mode, signature])
				} else {
					if (!this.useSmartSessions.permissionId) {
						throw new Error('USE mode must have permissionId')
					}
					userOp.signature = concat([
						this.useSmartSessions.mode,
						this.useSmartSessions.permissionId,
						signature,
					])
					console.log('smartsessions signature', userOp.signature)
				}
			} else {
				userOp.signature = signature
			}

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
		} catch (error: any) {
			console.error(`Failed to process calls for ${callId}:`, error)

			if (userOp) {
				if (error.message.includes('JSON-RPC error: eth_estimateUserOperationGas')) {
					// Mock gas values for userOp
					userOp.callGasLimit = '0xf423f' // 999,999 gas
					userOp.verificationGasLimit = '0xf423f' // 999,999 gas
					userOp.preVerificationGas = '0xf423f' // 999,999 gas

					// sign userOp
					const userOpHash = await fetchUserOpHash(userOp, provider)
					console.log('debug:userOpHash', userOpHash)

					const signature = await this.signer.signMessage(getBytes(userOpHash))

					console.log(`debug:signature, signer: ${this.signer.address}`, signature)

					if (this.useSmartSessions) {
						if (isEnableMode(this.useSmartSessions.mode)) {
							userOp.signature = concat([this.useSmartSessions.mode, signature])
						} else {
							if (!this.useSmartSessions.permissionId) {
								throw new Error('USE mode must have permissionId')
							}
							userOp.signature = concat([
								this.useSmartSessions.mode,
								this.useSmartSessions.permissionId,
								signature,
							])
						}
					} else {
						userOp.signature = signature
					}
				}
				// print handleOpsCalldata for debug
				const handlesOpsCalldata = getHandleOpsCalldata(userOp, sender)
				console.log('debug:handlesOpsCalldata', handlesOpsCalldata)
			}

			this.callStatuses.set(callId, {
				status: 'CONFIRMED',
			})
		}
	}

	private genCallId(): string {
		return hexlify(randomBytes(32))
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
}
