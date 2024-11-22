import { parseEther, toBeHex } from 'ethers'
import { WalletService, type CallsResult } from '../WalletService'

const walletService = new WalletService({ supportPaymaster: true })

const identifier = await walletService.sendCalls({
	version: '1',
	from: '0x67ce34bc421060b8594cdd361ce201868845045b',
	calls: [
		{
			to: '0xd78B5013757Ea4A7841811eF770711e6248dC282', // owner
			data: '0x',
			value: toBeHex(parseEther('0.001')),
		},
		{
			to: '0x9e8f8C3Ad87dBE7ACFFC5f5800e7433c8dF409F2', // owner
			data: '0x',
			value: toBeHex(parseEther('0.001')),
		},
	],
})

let result: CallsResult | null = null

while (!result || result.status === 'PENDING') {
	result = await walletService.getCallStatus(identifier)
	console.log('result', result)

	if (!result || result.status === 'PENDING') {
		await new Promise(resolve => setTimeout(resolve, 1000))
	}
}
