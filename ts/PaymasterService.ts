import { Contract, Interface, JsonRpcProvider, toBeHex } from 'ethers'
import { ENTRYPOINT } from './myAccount/utils'

if (!process.env.sepolia) {
	throw new Error('Missing .env')
}

const RPC_URL = process.env.sepolia
const CHAIN_ID = 11155111
const PAYMASTER_ADDRESS = '0xA2E1944eD3294f0202a063cc971ECe09cbd02e43'

const provider = new JsonRpcProvider(RPC_URL)
const paymasterInterface = new Interface(['function isAllowed(address _address) public view returns (bool)'])
const paymaster = new Contract(PAYMASTER_ADDRESS, paymasterInterface, provider)

type GetPaymasterStubDataParams = [
	// Below is specific to Entrypoint v0.6 but this API can be used with other entrypoint versions too
	{
		sender: string
		nonce: string
		initCode: string
		callData: string
		callGasLimit: string
		verificationGasLimit: string
		preVerificationGas: string
		maxFeePerGas: string
		maxPriorityFeePerGas: string
	}, // userOp
	string, // EntryPoint
	string, // Chain ID
	Record<string, any>, // Context
]

type GetPaymasterStubDataResult = {
	sponsor?: { name: string; icon?: string } // Sponsor info
	paymaster?: string // Paymaster address (entrypoint v0.7)
	paymasterData?: string // Paymaster data (entrypoint v0.7)
	paymasterVerificationGasLimit?: string // Paymaster validation gas (entrypoint v0.7)
	paymasterPostOpGasLimit?: string // Paymaster post-op gas (entrypoint v0.7)
	paymasterAndData?: string // Paymaster and data (entrypoint v0.6)
	isFinal?: boolean // Indicates that the caller does not need to call pm_getPaymasterData
}

export class PaymasterService {
	async getPaymasterStubData(params: GetPaymasterStubDataParams): Promise<GetPaymasterStubDataResult> {
		// check entrypoint and chain id is correct
		if (params[1] !== ENTRYPOINT || params[2] !== CHAIN_ID.toString()) {
			throw new Error('Entrypoint or chain id is incorrect')
		}

		// check sender is in allowlist
		const isAllowed = await paymaster.isAllowed(params[0].sender)
		if (!isAllowed) {
			throw new Error('Sender is not in allowlist')
		}

		return {
			sponsor: {
				name: 'My Wallet',
			},
			paymaster: PAYMASTER_ADDRESS,
			paymasterData: '0x',
			paymasterVerificationGasLimit: toBeHex(999_999n),
			paymasterPostOpGasLimit: toBeHex(999_999n),
			isFinal: true,
		}
	}
}
