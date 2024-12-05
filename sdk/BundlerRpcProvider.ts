import type { RpcRequestArguments } from './types'
import { logger } from './logger'

export class BundlerRpcProvider {
	private url: string

	constructor(url: string) {
		this.url = url
	}

	async send(request: RpcRequestArguments) {
		const response = await fetch(this.url, {
			method: 'post',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: request.method,
				id: 1,
				params: request.params,
			}),
		})

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		const data = await response.json()

		// Check for JSON-RPC error response
		if (data.error) {
			throw new Error(`JSON-RPC Error: ${request.method} ${data.error.code}: ${data.error.message}`)
		}

		return data.result
	}
}
