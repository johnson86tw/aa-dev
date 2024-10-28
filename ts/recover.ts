import { verifyMessage } from 'ethers'

const signature =
	'0x9464461fbba73e5e445da4b92003a7a13df69b9d84745c093dcfb55f79e4696d1882a900df7286d3e26bf34c9ddba7f0824b72642f751d7fa65e0312e3d8a05f1c'
const userOpHash = '0x90576fdc4552b2ea33f937aade31d760a3070f1bc56ea3cc793e46d1dbbf6089'
const signer = '0xd78B5013757Ea4A7841811eF770711e6248dC282'

const recoveredAddress = verifyMessage(userOpHash, signature)

console.log('recoveredAddress', recoveredAddress)
console.log('signer', signer)
