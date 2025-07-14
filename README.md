
# SimpleSwap DApp

A decentralized application (DApp) to interact with the `SimpleSwap` smart contract. Users can:

- Connect their Ethereum wallet (MetaMask)
- Swap **Token A ↔ Token B**
- Get real-time price between the two tokens

---

## 🧑‍💻 Author

- **Wayar Matias Nahuel**

## 📁 Project Structure

```plaintext
/contracts/           → Solidity smart contracts (SimpleSwap, ERC20Mock)
/docs/       → Frontend static files (HTML, CSS, JS)
  ├── index.html
  ├── styles.css
  └── app.js
/test/                → Hardhat test suite
/ignition/            → Smart contracts modules
hardhat.config.js     → Hardhat configuration
README.md             → Project documentation
```

---

## 🚀 Live Demo

You can try the frontend live at:

👉 [https://mnwayar.github.io/ethkipu-modulo4-tp/](https://mnwayar.github.io/ethkipu-modulo4-tp/)

Using contracts deployed to the Sepolia testnet.

- **Network**: Sepolia
- **SimpleSwap address**: `0x2debfF655D680D528f69449665Bfda617D544241`
- **Token A address**: `0x2d2B2C2af6f4F87E722E064dcD9fDd3F94ce7597`
- **Token B address**: `0xe7318ea312EE8b8faAD947136f4C1b0d75484667`
- **Faucet address**: `0x452D2D90345428e542F78B666572a3Db5cA9499e`
- **LP Token Symbol**: LQP

---

## ⚙️ Prerequisites

- Node.js >= 16.x
- Hardhat
- MetaMask (or any wallet supporting EIP-1193)
- Ethers.js v5 (used in frontend)
- A local or testnet Ethereum RPC (e.g., Hardhat, Sepolia)

---

## 🔧 Install & Compile Contracts

```bash
npm install
npx hardhat compile
```

---

## 🧪 Run Tests

```bash
npx hardhat test
```

---

## 📦 Deploy Contract (Optional)

To deploy the contract locally:

```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

---

## 🌐 Frontend Setup

The frontend is a simple static site. To view it locally:

```bash
cd docs
npx http-server .  # or use Live Server extension
```

To publish on GitHub Pages:

1. Push to GitHub.
2. In your repository settings, enable GitHub Pages using `/docs`.

---

## 🔐 Smart Contract Overview

### `SimpleSwap`

- `addLiquidity(...)`
- `removeLiquidity(...)`
- `swapExactTokensForTokens(...)`
- `getPrice(tokenA, tokenB)`
- `getAmountOut(amountIn, reserveIn, reserveOut)`

Includes validations for deadline, token pair, slippage, and more.

---

## 🧠 Built With

- [Solidity](https://soliditylang.org/)
- [Hardhat](https://hardhat.org/)
- [Ethers.js v5](https://docs.ethers.org/v5/)
- [MetaMask](https://metamask.io/)
- [GitHub Pages](https://pages.github.com/)

---

## 📜 License

This project is licensed under the [MIT License](./LICENSE).
