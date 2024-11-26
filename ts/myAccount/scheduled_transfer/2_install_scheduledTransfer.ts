import { AbiCoder, concat, Interface, parseEther, toBeHex } from 'ethers'
import { WalletService } from '../../WalletService'
import { MY_ACCOUNT_ADDRESS, padLeft, SCHEDULED_TRANSFER_ADDRESS } from './utils'

const walletService = new WalletService({ supportPaymaster: true })

// install scheduled transfer module

/*
initData: executeInterval (6) ++ nrOfExecutions (2) ++ startDate (6) ++ executionData
	- executionData = abi.encode(address recipient, address token, uint256 amount)
*/

const executeInterval = 10
const nrOfExecutions = 3
const startDate = Math.floor(Date.now() / 1000) + 25 * 60 // 25 minutes from now
const recipient = '0xd78B5013757Ea4A7841811eF770711e6248dC282'
const token = '0x0000000000000000000000000000000000000000'
const amount = toBeHex(parseEther('0.001'))

const abiCoder = new AbiCoder()
const initData = concat([
	padLeft(toBeHex(executeInterval), 6),
	padLeft(toBeHex(nrOfExecutions), 2),
	padLeft(toBeHex(startDate), 6),
	abiCoder.encode(['address', 'address', 'uint256'], [recipient, token, amount]),
])

console.log('initData', initData)

const call = {
	to: MY_ACCOUNT_ADDRESS,
	data: new Interface([
		'function installModule(uint256 moduleTypeId, address module, bytes calldata initData)',
	]).encodeFunctionData('installModule', [2, SCHEDULED_TRANSFER_ADDRESS, initData]),
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
