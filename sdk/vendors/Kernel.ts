import { concat, Contract, Interface, isAddress, JsonRpcProvider, toBeHex, ZeroAddress, zeroPadValue } from 'ethers'
import { addresses } from '../constants'
import type { Execution } from '../types'
import { AccountVendor } from '../types'
import { abiEncode, is32BytesHexString } from '../utils'

export class Kernel extends AccountVendor {
	static readonly accountId = 'kernel.advanced.v0.3.1'
	static readonly kernelFactoryInterface = new Interface([
		'function createAccount(bytes calldata data, bytes32 salt) public payable returns (address)',
		'function getAddress(bytes calldata data, bytes32 salt) public view returns (address)',
	])
	static readonly kernelInterface = new Interface([
		'function initialize(bytes21 _rootValidator, address hook, bytes calldata validatorData, bytes calldata hookData, bytes[] calldata initConfig) external',
	])

	async getNonceKey(validator: string) {
		return concat(['0x01', validator])
	}

	async getAddress(provider: JsonRpcProvider, validator: string, owner: string, salt: string): Promise<string> {
		if (!is32BytesHexString(salt)) {
			throw new Error('Salt should be 32 bytes')
		}

		const kernelFactory = new Contract(addresses.sepolia.KERNEL_FACTORY, Kernel.kernelFactoryInterface, provider)
		const address = await kernelFactory['getAddress(bytes,bytes32)'](this.getInitializeData(validator, owner), salt)

		if (!isAddress(address)) {
			throw new Error('Failed to get new address')
		}

		return address
	}

	getInitCodeData(validator: string, owner: string, salt: string) {
		return {
			factory: addresses.sepolia.KERNEL_FACTORY,
			factoryData: this.getCreateAccountData(validator, owner, salt),
		}
	}

	private getCreateAccountData(validator: string, owner: string, salt: string) {
		if (!is32BytesHexString(salt)) {
			throw new Error('Salt should be 32 bytes')
		}

		return Kernel.kernelFactoryInterface.encodeFunctionData('createAccount', [
			this.getInitializeData(validator, owner),
			salt,
		])
	}

	private getInitializeData(validator: string, owner: string) {
		if (!isAddress(validator) || !isAddress(owner)) {
			throw new Error('Invalid address')
		}

		return Kernel.kernelInterface.encodeFunctionData('initialize', [
			concat(['0x01', validator]),
			ZeroAddress,
			owner,
			'0x',
			[],
		])
	}

	// TODO:
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

	// static async getUninstallModuleDeInitData(accountAddress: string, clientUrl: string, uninstallModuleAddress: string)
}
