import { parseEther, toBeHex } from 'ethers'
import { WalletService } from './WalletService'

const from = '0x67ce34bc421060b8594cdd361ce201868845045b'

const walletService = new WalletService()

const call = {
	to: '0xd78B5013757Ea4A7841811eF770711e6248dC282', // owner
	data: '0x',
	value: toBeHex(parseEther('0.001')),
}

const identifier = await walletService.sendCalls({
	version: '1',
	from,
	calls: [call],
})

const status = await walletService.getCallStatus(identifier)

console.log(status)
