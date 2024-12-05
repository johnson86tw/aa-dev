import { Contract } from 'ethers'
import { JsonRpcProvider } from 'ethers'
import type { EventLog } from 'ethers'
import { addresses } from '../sdk/constants'

const eoaManagerAddress = '0xd78B5013757Ea4A7841811eF770711e6248dC282'

const provider = new JsonRpcProvider(process.env.sepolia)

const ecdsaValidator = new Contract(
	addresses.sepolia.ECDSA_VALIDATOR,
	['event OwnerRegistered(address indexed kernel, address indexed owner)'],
	provider,
)

const events = (await ecdsaValidator.queryFilter(
	ecdsaValidator.filters.OwnerRegistered(null, eoaManagerAddress),
)) as EventLog[]

for (const event of events) {
	console.log(event.transactionHash)
	console.log('SA', event.args[0])
}
