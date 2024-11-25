import { WalletService, type CallsResult } from '../../WalletService'
import { getInstallSmartSessionsCalldata, MY_ACCOUNT_ADDRESS } from './utils'

const walletService = new WalletService({ supportPaymaster: true })

// install smartsessions

const call = {
	to: MY_ACCOUNT_ADDRESS,
	data: getInstallSmartSessionsCalldata(),
	value: '0x0',
}

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
