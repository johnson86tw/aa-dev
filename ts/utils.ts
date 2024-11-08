import type { Signer } from 'ethers'
import type { JsonRpcProvider } from 'ethers'
import { concat, Contract, Interface, toBeHex, zeroPadValue } from 'ethers'

export const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' // v0.7

export type UserOperation = {
	sender: string
	nonce: string | number
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

export function createEntryPoint(providerOrSigner: JsonRpcProvider | Signer) {
	return new Contract(
		ENTRYPOINT,
		new Interface([
			'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
			'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
		]),
		providerOrSigner,
	)
}

export async function fetchUserOpHash(userOp: UserOperation, provider: JsonRpcProvider) {
	const packedUserOp = {
		sender: userOp.sender,
		nonce: userOp.nonce,
		initCode: userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x',
		callData: userOp.callData,
		accountGasLimits: concat([
			zeroPadValue(toBeHex(userOp.callGasLimit), 16),
			zeroPadValue(toBeHex(userOp.verificationGasLimit), 16),
		]),
		preVerificationGas: userOp.preVerificationGas,
		gasFees: concat([
			zeroPadValue(toBeHex(userOp.maxPriorityFeePerGas), 16),
			zeroPadValue(toBeHex(userOp.maxFeePerGas), 16),
		]),
		paymasterAndData:
			userOp.paymaster && userOp.paymasterData ? concat([userOp.paymaster, userOp.paymasterData]) : '0x',
		signature: '0x',
	}

	const entrypoint = createEntryPoint(provider)
	return await entrypoint.getUserOpHash(packedUserOp)
}
