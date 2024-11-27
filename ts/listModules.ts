import { Contract, EventLog, JsonRpcProvider } from 'ethers'

if (!process.env.sepolia) {
	throw new Error('Missing .env')
}

const RPC_URL = process.env.sepolia

const ACCOUNT_ADDRESS = '0x67ce34bc421060b8594cdd361ce201868845045b'
const FROM_BLOCK = 7034584

const provider = new JsonRpcProvider(RPC_URL)
const contract = new Contract(
	ACCOUNT_ADDRESS,
	[
		'event ModuleInstalled(uint256 moduleTypeId, address module)',
		'event ModuleUninstalled(uint256 moduleTypeId, address module)',
	],
	provider,
)

const installEvents = await contract.queryFilter(contract.filters.ModuleInstalled, FROM_BLOCK)
const uninstallEvents = await contract.queryFilter(contract.filters.ModuleUninstalled, FROM_BLOCK)

// Combine and sort events by block number and transaction index
const allEvents = [...installEvents, ...uninstallEvents].sort((a, b) => {
	if (a.blockNumber !== b.blockNumber) {
		return a.blockNumber - b.blockNumber
	}
	return a.transactionIndex - b.transactionIndex
}) as EventLog[]

// Track currently installed modules
const installedModules = new Map<string, Set<string>>() // moduleTypeId => Set of module addresses

console.log('Module History:')
console.log('==============')

for (let i = allEvents.length - 1; i >= 0; i--) {
	const event = allEvents[i]
	const { moduleTypeId, module } = event.args
	const typeId = moduleTypeId.toString()
	const action = event.fragment.name === 'ModuleInstalled' ? 'Installed' : 'Uninstalled'

	console.log(`Block ${event.blockNumber}: ${action} module type ${typeId} at ${module}`)

	// Update tracking
	if (action === 'Installed') {
		if (!installedModules.has(typeId)) {
			installedModules.set(typeId, new Set())
		}
		installedModules.get(typeId)!.add(module)
	} else {
		installedModules.get(typeId)?.delete(module)
		if (installedModules.get(typeId)?.size === 0) {
			installedModules.delete(typeId)
		}
	}
}

console.log('\nCurrently Installed Modules:')
console.log('==========================')
for (const [typeId, modules] of installedModules) {
	console.log(`Module Type ${typeId}:`)
	for (const module of modules) {
		console.log(`  - ${module}`)
	}
}
