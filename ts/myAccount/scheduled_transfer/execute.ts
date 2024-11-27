import { Interface } from 'ethers'
import { WalletService, type CallsResult } from '../../WalletService'
import { MY_ACCOUNT_ADDRESS, SCHEDULED_TRANSFER_ADDRESS, SMART_SESSIONS_USE_MODE } from './utils'

if (!process.env.SESSION_PRIVATE_KEY || !process.env.sepolia) {
	throw new Error('Missing .env')
}

const SESSION_PRIVATE_KEY = process.env.SESSION_PRIVATE_KEY

const PERMISSION_ID = '0xb72ded2811243e47314035a2ebc224f775e95edb8e4f26b883b2479d5be18b7a'

const call = {
	to: SCHEDULED_TRANSFER_ADDRESS,
	data: new Interface(['function executeOrder(uint256 jobId)']).encodeFunctionData('executeOrder', [1]),
	value: '0x0',
}

const walletService = new WalletService({
	supportPaymaster: true,
	useSmartSessions: {
		privateKey: SESSION_PRIVATE_KEY,
		mode: SMART_SESSIONS_USE_MODE,
		permissionId: PERMISSION_ID,
	},
})

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
