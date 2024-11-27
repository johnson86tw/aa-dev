import { Interface } from 'ethers'
import { WalletService, type CallsResult } from '../../WalletService'
import { MY_ACCOUNT_ADDRESS, SMART_SESSION_ADDRESS } from './utils'

const walletService = new WalletService({ supportPaymaster: true })

// install smartsessions

const call = {
	to: MY_ACCOUNT_ADDRESS,
	data: new Interface([
		'function installModule(uint256 moduleTypeId, address module, bytes calldata initData)',
	]).encodeFunctionData('installModule', [1, SMART_SESSION_ADDRESS, '0x02']),
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
