import { concat, dataLength, Interface, toBeHex, ZeroAddress, zeroPadBytes, zeroPadValue } from 'ethers'

// sepolia
export const SMART_SESSION_ADDRESS = '0xCF57f874F2fAd43379ac571bDea61B759baDBD9B'
export const SIMPLE_SESSION_VALIDATOR_ADDRESS = '0x61246aaA9057c4Df78416Ac1ff047C97b6eF392D'
export const SUDO_POLICY_ADDRESS = '0x32D14013c953D7409e90ABc482CdC9672C05D371'
export const MY_ACCOUNT_ADDRESS = '0x67ce34bc421060b8594cdd361ce201868845045b'

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
	const hook = ZeroAddress
	const validationData = '0x'
	const validationLength = padLeft(toBeHex(dataLength(validationData)))
	const validationOffset = padLeft('0x60')
	const hookLength = padLeft('0x0')
	const hookOffset = padLeft(toBeHex(BigInt(validationOffset) + BigInt(validationLength) + BigInt('0x20')))
	const selectorLength = padLeft('0x0')
	const selectorOffset = padLeft(toBeHex(BigInt(hookOffset) + BigInt('0x20')))

	const initData = concat([
		hook,
		validationOffset,
		hookOffset,
		selectorOffset,
		validationLength,
		validationData,
		hookLength,
		selectorLength,
	])

	return new Interface([
		'function installModule(uint256 moduleTypeId, address module, bytes calldata initData)',
	]).encodeFunctionData('installModule', [1, SMART_SESSION_ADDRESS, initData])
}
