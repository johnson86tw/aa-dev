import { Interface } from 'ethers'
import { WalletService, type CallsResult } from '../../WalletService'
import { MY_ACCOUNT_ADDRESS, SMART_SESSION_ADDRESS } from './utils'

const walletService = new WalletService({ supportPaymaster: true })

// install smartsessions

const call = {
	to: MY_ACCOUNT_ADDRESS,
	data: new Interface([
		'function installModule(uint256 moduleTypeId, address module, bytes calldata initData)',
	]).encodeFunctionData('installModule', [1, SMART_SESSION_ADDRESS, '0x']),
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
