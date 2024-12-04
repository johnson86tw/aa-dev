import { Contract } from 'ethers'
import { JsonRpcProvider } from 'ethers'
import { ECDSA_VALIDATOR_ADDRESS } from './sepolia_addresses'
import type { EventLog } from 'ethers'

const eoaManagerAddress = '0xd78B5013757Ea4A7841811eF770711e6248dC282'

const provider = new JsonRpcProvider(process.env.sepolia)

const ecdsaValidator = new Contract(
	ECDSA_VALIDATOR_ADDRESS,
	['event OwnerRegistered(address indexed kernel, address indexed owner)'],
	provider,
)

const events = (await ecdsaValidator.queryFilter(
	ecdsaValidator.filters.OwnerRegistered(null, eoaManagerAddress),
)) as EventLog[]

for (const event of events) {
	console.log(event.transactionHash)
	console.log(event.args)
}
