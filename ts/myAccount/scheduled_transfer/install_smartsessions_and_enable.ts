import { concat, hexlify, Interface, randomBytes } from 'ethers'
import { WalletService, type CallsResult } from '../../WalletService'
import {
	MY_ACCOUNT_ADDRESS,
	SCHEDULED_TRANSFER_ADDRESS,
	SESSION_PUBLIC_KEY,
	SIMPLE_SESSION_VALIDATOR_ADDRESS,
	SMART_SESSION_ADDRESS,
	SMART_SESSIONS_UNSAFE_ENABLE_MODE,
	SUDO_POLICY_ADDRESS,
	type Session,
} from './utils'
import ISmartSessionJSON from '../../abis/ISmartSession.json'

const smartSessionsInterface = new Interface(ISmartSessionJSON.abi)

const salt = '0xdb787b0b2cf9e21d9d85ac2d8db4c1497f2fcf996ea231808c54d69c247785d0'

const sessions: Session[] = [
	{
		sessionValidator: SIMPLE_SESSION_VALIDATOR_ADDRESS,
		sessionValidatorInitData: SESSION_PUBLIC_KEY,
		salt,
		userOpPolicies: [],
		erc7739Policies: {
			erc1271Policies: [],
			allowedERC7739Content: [],
		},
		actions: [
			{
				actionTargetSelector: new Interface(['function executeOrder(uint256 jobId)']).getFunction(
					'executeOrder',
				)!.selector,
				actionTarget: SCHEDULED_TRANSFER_ADDRESS,
				actionPolicies: [
					{
						policy: SUDO_POLICY_ADDRESS,
						initData: '0x',
					},
				],
			},
		],
	},
]

const encodedSessions = '0x' + smartSessionsInterface.encodeFunctionData('enableSessions', [sessions]).slice(10)
const initData = concat([SMART_SESSIONS_UNSAFE_ENABLE_MODE, encodedSessions])

const call = {
	to: MY_ACCOUNT_ADDRESS,
	data: new Interface([
		'function installModule(uint256 moduleTypeId, address module, bytes calldata initData)',
	]).encodeFunctionData('installModule', [1, SMART_SESSION_ADDRESS, initData]),
	value: '0x0',
}

const walletService = new WalletService({ supportPaymaster: true })
const identifier = await walletService.sendCalls({
	version: '1',
	from: MY_ACCOUNT_ADDRESS,
	calls: [call],
})

let result: CallsResult | null = null

while (!result || result.status === 'PENDING') {
	result = await walletService.getCallStatus(identifier)

	if (!result || result.status === 'PENDING') {
		await new Promise(resolve => setTimeout(resolve, 1000))
	}
}

if (result.status === 'CONFIRMED' && result?.receipts) {
	result.receipts.forEach(receipt => {
		console.log('txHash', receipt.transactionHash)
	})
}
