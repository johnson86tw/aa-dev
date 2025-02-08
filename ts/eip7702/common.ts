export const mekong = {
	id: 7078815900,
	name: 'Mekong',
	nativeCurrency: { name: 'Mekong Ether', symbol: 'ETH', decimals: 18 },
	rpcUrls: {
		default: {
			http: ['https://rpc.mekong.ethpandaops.io'],
		},
	},
	blockExplorers: {
		default: {
			name: 'Etherscan',
			url: 'https://explorer.mekong.ethpandaops.io',
			apiUrl: '',
		},
	},
	testnet: true,
}

export const devnet5 = {
	id: 7088110746,
	name: 'Devnet5',
	nativeCurrency: { name: 'Devnet5 Ether', symbol: 'ETH', decimals: 18 },
	rpcUrls: {
		default: {
			http: ['https://rpc.pectra-devnet-5.ethpandaops.io'],
		},
	},
	blockExplorers: {
		default: {
			name: 'Etherscan',
			url: 'https://explorer.pectra-devnet-5.ethpandaops.io',
			apiUrl: '',
		},
	},
	testnet: true,
}
