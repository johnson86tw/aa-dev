import { AbiCoder, Contract, Interface, JsonRpcProvider } from 'ethers'
import { WalletService, type CallsResult } from '../../WalletService'
import { MY_ACCOUNT_ADDRESS, padLeft, SMART_SESSION_ADDRESS } from './utils'

if (!process.env.sepolia) {
	throw new Error('Missing .env')
}
const RPC_URL = process.env.sepolia

const provider = new JsonRpcProvider(RPC_URL)

// ================================ build deInitData ==========================================

const myAccount = new Contract(
	MY_ACCOUNT_ADDRESS,
	[
		'function getValidatorsPaginated(address cursor, uint256 size) external view returns (address[] memory array, address next)',
	],
	provider,
)

const validators = await myAccount.getValidatorsPaginated(padLeft('0x1', 20), 5)
const prev = findPrevious(validators.array, SMART_SESSION_ADDRESS)

const deInitData = new AbiCoder().encode(['address', 'bytes'], [prev, '0x'])

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

// ================================ end build deInitData ==========================================

const walletService = new WalletService({ supportPaymaster: true })

const call = {
	to: MY_ACCOUNT_ADDRESS,
	data: new Interface([
		'function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData)',
	]).encodeFunctionData('uninstallModule', [1, SMART_SESSION_ADDRESS, deInitData]),
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
