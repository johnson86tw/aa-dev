import { AbiCoder, Interface, keccak256, zeroPadBytes, zeroPadValue } from 'ethers'

export const SMART_SESSIONS_USE_MODE = '0x00'
export const SMART_SESSIONS_ENABLE_MODE = '0x01'
export const SMART_SESSIONS_UNSAFE_ENABLE_MODE = '0x02'

export type SmartSessionsMode =
	| typeof SMART_SESSIONS_USE_MODE
	| typeof SMART_SESSIONS_ENABLE_MODE
	| typeof SMART_SESSIONS_UNSAFE_ENABLE_MODE

export function isEnableMode(mode: SmartSessionsMode) {
	return mode === SMART_SESSIONS_ENABLE_MODE || mode === SMART_SESSIONS_UNSAFE_ENABLE_MODE
}

// sepolia
export const MY_ACCOUNT_ADDRESS = '0x67ce34bc421060b8594cdd361ce201868845045b'
export const SMART_SESSION_ADDRESS = '0xCF57f874F2fAd43379ac571bDea61B759baDBD9B'
export const SIMPLE_SESSION_VALIDATOR_ADDRESS = '0x61246aaA9057c4Df78416Ac1ff047C97b6eF392D'
export const SUDO_POLICY_ADDRESS = '0x32D14013c953D7409e90ABc482CdC9672C05D371'
export const SCHEDULED_TRANSFER_ADDRESS = '0x88EA6ae18FBc2bB092c34F59004940E3cb137506'
export const SESSION_PUBLIC_KEY = '0xb04662Edea81c9BD5717544514e7F2D14B148fF5'

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

export function getInstallSmartSessionsCalldata() {
	// const hook = ZeroAddress
	// const validationData = '0x'
	// const validationLength = padLeft(toBeHex(dataLength(validationData)))
	// const validationOffset = padLeft('0x60')
	// const hookLength = padLeft('0x0')
	// const hookOffset = padLeft(toBeHex(BigInt(validationOffset) + BigInt(validationLength) + BigInt('0x20')))
	// const selectorLength = padLeft('0x0')
	// const selectorOffset = padLeft(toBeHex(BigInt(hookOffset) + BigInt('0x20')))

	// const initData = concat([
	// 	hook,
	// 	validationOffset,
	// 	hookOffset,
	// 	selectorOffset,
	// 	validationLength,
	// 	validationData,
	// 	hookLength,
	// 	selectorLength,
	// ])

	return new Interface([
		'function installModule(uint256 moduleTypeId, address module, bytes calldata initData)',
	]).encodeFunctionData('installModule', [1, SMART_SESSION_ADDRESS, '0x'])
}

export type Session = {
	sessionValidator: string // address
	sessionValidatorInitData: string // bytes -> hex string
	salt: string // bytes32 -> hex string
	userOpPolicies: {
		policy: string // address
		initData: string // bytes -> hex string
	}[]
	erc7739Policies: {
		erc1271Policies: {
			policy: string // address
			initData: string // bytes -> hex string
		}[]
		allowedERC7739Content: string[]
	}
	actions: {
		actionTargetSelector: string // bytes4 -> hex string
		actionTarget: string // address
		actionPolicies: {
			policy: string // address
			initData: string // bytes -> hex string
		}[]
	}[]
	canUsePaymaster: boolean
}

function getPermissionId(validator: string, initData: string, salt: string) {
	return keccak256(new AbiCoder().encode(['address', 'bytes', 'bytes32'], [validator, initData, salt]))
}
