import {
	concat,
	Contract,
	hexlify,
	Interface,
	isAddress,
	JsonRpcProvider,
	toBeHex,
	zeroPadValue,
	type BytesLike,
} from 'ethers'
import type { Execution } from '../types'
import { AccountVendor } from '../types'
import { abiEncode, padLeft } from '../utils'

const MY_ACCOUNT_FACTORY_ADDRESS = '0x7cdf84c1d0915748Df0f1dA6d92701ac6A903E41'

export class MyAccount extends AccountVendor {
	static readonly accountId = 'johnson86tw.0.0.1'

	async getNonceKey(validator: string) {
		return zeroPadValue(validator, 24)
	}

	async getCallData(from: string, executions: Execution[]) {
		let callData

		// if one of the execution is to SA itself, it must be a single execution
		if (executions.some(execution => execution.to === from)) {
			if (executions.length > 1) {
				throw new Error('If one of the execution is to SA itself, it must be a single execution')
			}

			callData = executions[0].data
		} else {
			/**
			 * ModeCode:
			 * |--------------------------------------------------------------------|
			 * | CALLTYPE  | EXECTYPE  |   UNUSED   | ModeSelector  |  ModePayload  |
			 * |--------------------------------------------------------------------|
			 * | 1 byte    | 1 byte    |   4 bytes  | 4 bytes       |   22 bytes    |
			 * |--------------------------------------------------------------------|
			 */
			const callType = executions.length > 1 ? '0x01' : '0x00'
			const modeCode = concat([
				callType,
				'0x00',
				'0x00000000',
				'0x00000000',
				'0x00000000000000000000000000000000000000000000',
			])

			const executionsData = executions.map(execution => ({
				target: execution.to || '0x',
				value: BigInt(execution.value || '0x0'),
				data: execution.data || '0x',
			}))

			let executionCalldata
			if (callType === '0x01') {
				// batch execution
				executionCalldata = abiEncode(
					['tuple(address,uint256,bytes)[]'],
					[executionsData.map(execution => [execution.target, execution.value, execution.data])],
				)
			} else {
				// single execution
				executionCalldata = concat([
					executionsData[0].target,
					zeroPadValue(toBeHex(executionsData[0].value), 32),
					executionsData[0].data,
				])
			}

			callData = new Interface([
				'function execute(bytes32 mode, bytes calldata executionCalldata)',
			]).encodeFunctionData('execute', [modeCode, executionCalldata])
		}

		if (!callData) {
			throw new Error('Failed to build callData')
		}

		return callData
	}

	async getAddress(provider: JsonRpcProvider, salt: BytesLike, validator: string, owner: string): Promise<string> {
		const myAccountFactory = new Contract(
			MY_ACCOUNT_FACTORY_ADDRESS,
			['function getAddress(uint256 salt, address validator, bytes calldata data) public view returns (address)'],
			provider,
		)
		const address = await myAccountFactory['getAddress(uint256,address,bytes)'](salt, validator, owner)

		if (!isAddress(address)) {
			throw new Error('Failed to get new address')
		}

		return address
	}

	getInitCodeData(salt: BytesLike, validator: string, owner: string) {
		return {
			factory: MY_ACCOUNT_FACTORY_ADDRESS,
			factoryData: new Interface([
				'function createAccount(uint256 salt, address validator, bytes calldata data)',
			]).encodeFunctionData('createAccount', [salt, validator, owner]),
		}
	}

	async getInstallModuleInitData(initData: BytesLike) {
		return hexlify(initData)
	}

	async getUninstallModuleDeInitData(
		accountAddress: string,
		clientUrl: string,
		uninstallModuleAddress: string,
	): Promise<string> {
		const myAccount = new Contract(
			accountAddress,
			[
				'function getValidatorsPaginated(address cursor, uint256 size) external view returns (address[] memory array, address next)',
			],
			new JsonRpcProvider(clientUrl),
		)

		const validators = await myAccount.getValidatorsPaginated(padLeft('0x1', 20), 5)
		const prev = findPrevious(validators.array, uninstallModuleAddress)
		function findPrevious(array: string[], entry: string): string {
			for (let i = 0; i < array.length; i++) {
				if (array[i].toLowerCase() === entry.toLowerCase()) {
					if (i === 0) {
						return padLeft('0x1', 20)
					} else {
						return array[i - 1]
					}
				}
			}
			throw new Error('Entry not found in array')
		}

		const deInitData = abiEncode(['address', 'bytes'], [prev, '0x'])

		return deInitData
	}
}
