# aa-dev

- ERC-7579 Modular Smart Account
- Validation for ECDSA and WebAuthn
- Sending a user operation with ethers v6

> [!WARNING]
> This project is for development and learning purposes only


## Versions

- solidity v0.8.27
- account-abstraction v0.7.0
- openzeppelin v5.1.0
- Solady v0.0.260


## Credits

- https://github.com/consenlabs/ethtaipei2023-aa-workshop
- https://github.com/bcnmy/nexus
- `types/*` and ECDSAValidator is from https://github.com/zerodevapp/kernel
- `core/*`, `interfaces/*`, `lib/*` is from https://github.com/erc7579/erc7579-implementation

**Webauthn/Passkeys*
- `modules/webauthn/*` is from https://github.com/zerodevapp/kernel-7579-plugins
- https://github.com/zerodevapp/sdk
- https://github.com/zerodevapp/passkey-tutorial
- https://github.com/zerodevapp/passkey-server

---

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
