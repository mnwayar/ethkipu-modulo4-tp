const connectBtn = document.getElementById("connectBtn");
const accountDiv = document.getElementById("account");
const getPriceBtn = document.getElementById("getPriceBtn");
const priceResultDiv = document.getElementById("priceResult");
const swapBtn = document.getElementById("swapBtn");
const messagesDiv = document.getElementById("messages");

let provider;
let signer;
let simpleSwapContract;

const SIMPLE_SWAP_ADDRESS = "0x2debfF655D680D528f69449665Bfda617D544241";
const TOKEN_A_ADDRESS = "0x2d2B2C2af6f4F87E722E064dcD9fDd3F94ce7597";
const TOKEN_B_ADDRESS = "0xe7318ea312EE8b8faAD947136f4C1b0d75484667";

const SIMPLE_SWAP_ABI = [
  "function getPrice(address tokenA, address tokenB) external view returns (uint)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint amountOut)",
  "function token_A() view returns (address)",
  "function token_B() view returns (address)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function connectWallet() {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    const address = await signer.getAddress();
    accountDiv.textContent = `Connected: ${address}`;

    simpleSwapContract = new ethers.Contract(SIMPLE_SWAP_ADDRESS, SIMPLE_SWAP_ABI, signer);
  } else {
    alert("Please install MetaMask!");
  }
}

connectBtn.addEventListener("click", connectWallet);

getPriceBtn.addEventListener("click", async () => {
  try {
    const direction = document.getElementById("priceDirection").value;
    const tokenA = direction === "AtoB" ? TOKEN_A_ADDRESS : TOKEN_B_ADDRESS;
    const tokenB = direction === "AtoB" ? TOKEN_B_ADDRESS : TOKEN_A_ADDRESS;

    const price = await simpleSwapContract.getPrice(tokenA, tokenB);
    const readablePrice = ethers.utils.formatUnits(price, 18);
    priceResultDiv.textContent = `Price: ${readablePrice}`;
  } catch (err) {
    console.error(err);
    priceResultDiv.textContent = "Error getting price.";
  }
});

swapBtn.addEventListener("click", async () => {
  try {
    const direction = document.getElementById("swapDirection").value;
    const amount = document.getElementById("swapAmount").value;
    const amountIn = ethers.utils.parseUnits(amount, 18);

    const tokenIn = direction === "AtoB" ? TOKEN_A_ADDRESS : TOKEN_B_ADDRESS;
    const tokenOut = direction === "AtoB" ? TOKEN_B_ADDRESS : TOKEN_A_ADDRESS;
    const path = [tokenIn, tokenOut];

    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);

    const allowance = await tokenContract.allowance(await signer.getAddress(), SIMPLE_SWAP_ADDRESS);
    if (allowance.lt(amountIn)) {
      const tx = await tokenContract.approve(SIMPLE_SWAP_ADDRESS, ethers.constants.MaxUint256);
      await tx.wait();
      messagesDiv.textContent = "Approved token for swap.";
    }

    const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 min
    const tx = await simpleSwapContract.swapExactTokensForTokens(
      amountIn,
      0, // amountOutMin
      path,
      await signer.getAddress(),
      deadline
    );
    const receipt = await tx.wait();
    messagesDiv.textContent = `Swap complete! Tx Hash: ${receipt.transactionHash}`;
  } catch (err) {
    console.error(err);
    messagesDiv.textContent = "Swap failed. Check console.";
  }
});
