import { getAddress } from 'viem'
import { privateKeyToAddress, toAccount } from 'viem/accounts'
import { signMessage, signTransaction, signTypedData } from 'viem/accounts'

if (!process.env.PIMLICO_API_KEY || !process.env.sepolia || !process.env.PRIVATE_KEY) {
	throw new Error('Missing .env')
}

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const RPC_URL = process.env.sepolia

const account = toAccount({
	address: privateKeyToAddress(privateKey),

	async signMessage({ message }) {
		return signMessage({ message, privateKey })
	},

	async signTransaction(transaction) {
		return signTransaction({ privateKey, transaction })
	},

	async signTypedData(typedData) {
		return signTypedData({ ...typedData, privateKey })
	},
})

const messageHash = '0x47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad'

account.signMessage({ message: messageHash }).then(console.log).catch(console.error)
