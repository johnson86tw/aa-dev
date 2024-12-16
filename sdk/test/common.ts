import { logger } from '../logger'
import type { WebWallet } from '../WebWallet'

export function getEnv() {
	if (!process.env.PIMLICO_API_KEY || !process.env.ALCHEMY_API_KEY || !process.env.PRIVATE_KEY) {
		throw new Error('Missing .env')
	}

	const PRIVATE_KEY = process.env.PRIVATE_KEY
	const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
	const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY

	return {
		PRIVATE_KEY,
		ALCHEMY_API_KEY,
		PIMLICO_API_KEY,
	}
}

export function askForChainId() {
	const defaultChainId = '11155111'
	const chainIdInput = prompt('Enter chainId (defaults to 11155111):')
	const chainId =
		chainIdInput === 's' ? defaultChainId : chainIdInput === 'm' ? '7078815900' : chainIdInput || defaultChainId

	logger.info(`ChainId: ${chainId}`)
	return chainId
}

export async function askForSender(wallet: WebWallet, validatorId: string = 'eoa-managed') {
	logger.info('Fetching accounts...')
	const accounts = await wallet.fetchAccountsByValidator(validatorId)

	accounts.forEach((account, index) => {
		logger.info(`[${index}] ${account.accountId} ${account.address}`)
	})

	// Prompt for account selection
	const selectedIndex = prompt('Select account index (defaults to 1):') || '1'
	if (selectedIndex === null || isNaN(Number(selectedIndex)) || Number(selectedIndex) >= accounts.length) {
		logger.error('Invalid account index')
		process.exit()
	}

	const sender = accounts[Number(selectedIndex)].address
	logger.info('Sender:', sender)
	return sender
}
