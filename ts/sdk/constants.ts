export const SESSION_PUBLIC_KEY = '0xb04662Edea81c9BD5717544514e7F2D14B148fF5'
export const OWNER_ADDRESS = '0xd78B5013757Ea4A7841811eF770711e6248dC282'
export const MY_ACCOUNT_ADDRESS = '0x67ce34bc421060b8594cdd361ce201868845045b'

interface Addresses {
	readonly sepolia: {
		ENTRY_POINT: string
		SMART_SESSION: string
		SIMPLE_SESSION_VALIDATOR: string
		SUDO_POLICY: string
		SCHEDULED_TRANSFER: string
		ECDSA_VALIDATOR: string
		MY_ACCOUNT_FACTORY: string
	}
}

export const addresses: Addresses = {
	sepolia: {
		ENTRY_POINT: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
		SMART_SESSION: '0xCF57f874F2fAd43379ac571bDea61B759baDBD9B',
		SIMPLE_SESSION_VALIDATOR: '0x61246aaA9057c4Df78416Ac1ff047C97b6eF392D',
		SUDO_POLICY: '0x32D14013c953D7409e90ABc482CdC9672C05D371',
		SCHEDULED_TRANSFER: '0x88EA6ae18FBc2bB092c34F59004940E3cb137506',
		ECDSA_VALIDATOR: '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4',
		MY_ACCOUNT_FACTORY: '0x7cdf84c1d0915748Df0f1dA6d92701ac6A903E41',
	},
}
