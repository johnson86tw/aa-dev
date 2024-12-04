import {
	FetchRequest,
	JsonRpcProvider,
	type JsonRpcApiProviderOptions,
	type JsonRpcPayload,
	type JsonRpcResult,
	type Networkish,
} from 'ethers'

export class BundlerProvider extends JsonRpcProvider {
	constructor(url?: string | FetchRequest, network?: Networkish, options?: JsonRpcApiProviderOptions) {
		super(url, network, options)
	}

	async _send(payload: JsonRpcPayload | Array<JsonRpcPayload>): Promise<Array<JsonRpcResult>> {
		const isValidMethod = (method: string) => {
			return (
				method === 'eth_sendUserOperation' ||
				method === 'eth_estimateUserOperationGas' ||
				method === 'eth_getUserOperationByHash' ||
				method === 'eth_getUserOperationReceipt' ||
				method === 'eth_supportedEntryPoints' ||
				method === 'eth_chainId'
			)
		}

		if (Array.isArray(payload)) {
			for (const singlePayload of payload) {
				if (!isValidMethod(singlePayload.method)) {
					throw new Error('Invalid method')
				}
			}
		} else if (!isValidMethod(payload.method)) {
			throw new Error('Invalid method')
		}

		// Configure a POST connection for the requested method
		const request = this._getConnection()
		request.body = JSON.stringify(payload)
		request.setHeader('content-type', 'application/json')
		const response = await request.send()
		response.assertOk()

		let resp = response.bodyJson
		if (!Array.isArray(resp)) {
			resp = [resp]
		}

		return resp
	}
}
