import type { BytesLike, JsonRpcProvider } from 'ethers'
import { concat, Contract, isAddress, toBeHex, zeroPadValue } from 'ethers'
import { addresses } from './constants'
import type { Call } from './types'
import { abiEncode } from './utils'
import { Interface } from 'ethers'

export interface AccountVendor {
	getNonceKey(validator: string): Promise<string>
	getCallData(from: string, calls: Call[]): Promise<string>
}

export class MyAccount implements AccountVendor {
	async getNonceKey(validator: string) {
		return zeroPadValue(validator, 24)
	}

	async getCallData(from: string, calls: Call[]) {
		let callData

		// if one of the call is to SA itself, it must be a single call
		if (calls.some(call => call.to === from)) {
			if (calls.length > 1) {
				throw new Error('If one of the call is to SA itself, it must be a single call')
			}

			callData = calls[0].data
		} else {
			/**
			 * ModeCode:
			 * |--------------------------------------------------------------------|
			 * | CALLTYPE  | EXECTYPE  |   UNUSED   | ModeSelector  |  ModePayload  |
			 * |--------------------------------------------------------------------|
			 * | 1 byte    | 1 byte    |   4 bytes  | 4 bytes       |   22 bytes    |
			 * |--------------------------------------------------------------------|
			 */
			const callType = calls.length > 1 ? '0x01' : '0x00'
			const modeCode = concat([
				callType,
				'0x00',
				'0x00000000',
				'0x00000000',
				'0x00000000000000000000000000000000000000000000',
			])

			const executions = calls.map(call => ({
				target: call.to || '0x',
				value: BigInt(call.value || '0x0'),
				data: call.data || '0x',
			}))

			let executionCalldata
			if (callType === '0x01') {
				// batch execution
				executionCalldata = abiEncode(
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
		}

		if (!callData) {
			throw new Error('Failed to build callData')
		}

		return callData
	}

	async getNewAddress(
		provider: JsonRpcProvider,
		salt: BytesLike,
		validator: string,
		owner: string,
	): Promise<string | null> {
		const myAccountFactory = new Contract(
			addresses.sepolia.MY_ACCOUNT_FACTORY,
			['function getAddress(uint256 salt, address validator, bytes calldata data) public view returns (address)'],
			provider,
		)
		const address = await myAccountFactory['getAddress(uint256,address,bytes)'](salt, validator, owner)

		if (!isAddress(address)) {
			return null
		}

		return address
	}
}
