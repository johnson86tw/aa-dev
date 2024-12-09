import { AbiCoder, concat, ParamType, toBeHex, zeroPadBytes, zeroPadValue } from 'ethers'
import type { PackedUserOperation, UserOperation } from './types'

export function is32BytesHexString(data: string) {
	return data.startsWith('0x') && data.length === 66
}

export function padLeft(data: string, length: number = 32) {
	if (!data.startsWith('0x')) {
		throw new Error('data must start with 0x')
	}
	if (data.length % 2 !== 0) {
		data = data.slice(0, 2) + '0' + data.slice(2)
	}
	return zeroPadValue(data, length)
}

export function padRight(data: string, length: number = 32) {
	if (!data.startsWith('0x')) {
		throw new Error('data must start with 0x')
	}
	if (data.length % 2 !== 0) {
		data = data.slice(0, 2) + '0' + data.slice(2)
	}
	return zeroPadBytes(data, length)
}

export function abiEncode(types: ReadonlyArray<string | ParamType>, values: ReadonlyArray<any>): string {
	return new AbiCoder().encode(types, values)
}

export function getEmptyUserOp(): UserOperation {
	return {
		sender: '',
		nonce: '0x',
		factory: null,
		factoryData: '0x',
		callData: '0x',
		callGasLimit: '0x0',
		verificationGasLimit: '0x0',
		preVerificationGas: '0x0',
		maxFeePerGas: '0x0',
		maxPriorityFeePerGas: '0x0',
		paymaster: null,
		paymasterVerificationGasLimit: '0x0',
		paymasterPostOpGasLimit: '0x0',
		paymasterData: null,
		signature: '0x',
	}
}

export function packUserOp(userOp: UserOperation): PackedUserOperation {
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
