import { getBytes, hexlify, toBeHex } from 'ethers'

const hex =
	'0x00b72ded2811243e47314035a2ebc224f775e95edb8e4f26b883b2479d5be18b7a010000e014010020e0141d1f00004173348f822e4c7b2d001bc5a87531ef59e0c169b7c98923aa751452d16b1fce8ded484878fa07efd909498f99750914fca25bb9ea646b9b019c3ed5da3b7303d259981b2044e00e00040000000000'
const offset = 33
const value = getBytes(hex).slice(offset)

console.log(`Value: ${offset}: ${hexlify(value)}`)
