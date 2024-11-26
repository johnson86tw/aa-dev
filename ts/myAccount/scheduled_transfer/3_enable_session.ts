import { hexlify, Interface, randomBytes } from 'ethers'
import { WalletService } from '../../WalletService'
import {
	MY_ACCOUNT_ADDRESS,
	SCHEDULED_TRANSFER_ADDRESS,
	SESSION_PUBLIC_KEY,
	SIMPLE_SESSION_VALIDATOR_ADDRESS,
	SMART_SESSION_ADDRESS,
	SUDO_POLICY_ADDRESS,
} from './utils'
import ISmartSessionJSON from '../../abis/ISmartSession.json'

const walletService = new WalletService({ supportPaymaster: true })

// enable sessions

const smartSessionsInterface = new Interface(ISmartSessionJSON.abi)

type Session = {
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
}

const sessions: Session[] = [
	{
		sessionValidator: SIMPLE_SESSION_VALIDATOR_ADDRESS,
		sessionValidatorInitData: SESSION_PUBLIC_KEY,
		salt: hexlify(randomBytes(32)),
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

const call = {
	to: SMART_SESSION_ADDRESS,
	data: smartSessionsInterface.encodeFunctionData('enableSessions', [sessions]),
	value: '0x0',
}

const callId = await walletService.sendCalls({
	version: '1',
	from: MY_ACCOUNT_ADDRESS,
	calls: [call],
})

const receipts = await walletService.waitForReceipts(callId)

receipts &&
	receipts.forEach(receipt => {
		console.log('txHash', receipt.transactionHash)
	})
