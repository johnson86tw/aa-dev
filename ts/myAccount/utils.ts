import type { Signer } from 'ethers'
import type { JsonRpcProvider } from 'ethers'
import { concat, Contract, Interface, toBeHex, zeroPadValue } from 'ethers'

export const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' // v0.7

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

export function getEntryPointInterface() {
	return new Interface([
		'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
		'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
		'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external',
	])
}

export function createEntryPoint(providerOrSigner: JsonRpcProvider | Signer) {
	return new Contract(ENTRYPOINT, getEntryPointInterface(), providerOrSigner)
}

export async function fetchUserOpHash(userOp: UserOperation, provider: JsonRpcProvider) {
	const entrypoint = createEntryPoint(provider)
	return await entrypoint.getUserOpHash(packUserOp(userOp))
}

export function getHandleOpsCalldata(userOp: UserOperation, beneficiary: string) {
	return getEntryPointInterface().encodeFunctionData('handleOps', [[packUserOp(userOp)], beneficiary])
}

export function packUserOp(userOp: UserOperation) {
	return {
		sender: userOp.sender,
		nonce: userOp.nonce,
		initCode: userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x',
		callData: userOp.callData,
		accountGasLimits: concat([
			zeroPadValue(toBeHex(userOp.verificationGasLimit), 16),
			zeroPadValue(toBeHex(userOp.callGasLimit), 16),
		]),
		preVerificationGas: zeroPadValue(toBeHex(userOp.preVerificationGas), 32),
		gasFees: concat([
			zeroPadValue(toBeHex(userOp.maxPriorityFeePerGas), 16),
			zeroPadValue(toBeHex(userOp.maxFeePerGas), 16),
		]),
		paymasterAndData:
			userOp.paymaster && userOp.paymasterData
				? concat([
						userOp.paymaster,
						zeroPadValue(toBeHex(userOp.paymasterVerificationGasLimit), 16),
						zeroPadValue(toBeHex(userOp.paymasterPostOpGasLimit), 16),
						userOp.paymasterData,
				  ])
				: '0x',
		signature: userOp.signature,
	}
}

export class Bundler {
	private bundlerUrl: string

	constructor(bundlerUrl: string) {
		this.bundlerUrl = bundlerUrl
	}

	async request(method: string, params: any[] = []) {
		const response = await fetch(this.bundlerUrl, {
			method: 'post',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method,
				id: 1,
				params,
			}),
		})

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		const data = await response.json()

		// Check for JSON-RPC error response
		if (data.error) {
			throw new Error(`JSON-RPC error: ${method} - ${JSON.stringify(data.error)}`)
		}

		return data.result
	}
}
