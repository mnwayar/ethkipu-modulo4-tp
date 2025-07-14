const simpleSwapAddress = "0x2debfF655D680D528f69449665Bfda617D544241"; 
const tokenAAddress = "0x2d2B2C2af6f4F87E722E064dcD9fDd3F94ce7597";          // Reemplaza con dirección token A
const tokenBAddress = "0xe7318ea312EE8b8faAD947136f4C1b0d75484667";          // Reemplaza con dirección token B

const abiSimpleSwap = [
  "function getPrice(address tokenA, address tokenB) external view returns (uint)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

const abiERC20 = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

let provider;
let signer;
let simpleSwapContract;
let tokenAContract;
let tokenBContract;
let userAddress;

const connectBtn = document.getElementById("connectBtn");
const accountDiv = document.getElementById("account");
const getPriceBtn = document.getElementById("getPriceBtn");
const priceResultDiv = document.getElementById("priceResult");
const swapBtn = document.getElementById("swapBtn");
const messagesDiv = document.getElementById("messages");

async function connectWallet() {
  if (!window.ethereum) {
    alert("Please install MetaMask or another Ethereum wallet");
    return;
  }
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  userAddress = await signer.getAddress();

  simpleSwapContract = new ethers.Contract(simpleSwapAddress, abiSimpleSwap, signer);
  tokenAContract = new ethers.Contract(tokenAAddress, abiERC20, signer);
  tokenBContract = new ethers.Contract(tokenBAddress, abiERC20, signer);

  accountDiv.textContent = `Connected: ${userAddress}`;
  connectBtn.disabled = true;
}

async function getPrice() {
  priceResultDiv.textContent = "";
  messagesDiv.textContent = "";
  const direction = document.getElementById("priceDirection").value;

  let price;
  try {
    if(direction === "AtoB") {
      price = await simpleSwapContract.getPrice(tokenAAddress, tokenBAddress);
    } else {
      price = await simpleSwapContract.getPrice(tokenBAddress, tokenAAddress);
    }
    const formatted = ethers.formatEther(price);
    priceResultDiv.textContent = `Price: ${formatted}`;
  } catch (err) {
    priceResultDiv.textContent = "Error fetching price";
    console.error(err);
  }
}

async function swapTokens() {
  messagesDiv.textContent = "";
  const direction = document.getElementById("swapDirection").value;
  let amountIn = document.getElementById("swapAmount").value;
  if(!amountIn || Number(amountIn) <= 0){
    messagesDiv.textContent = "Please enter a valid amount";
    return;
  }
  amountIn = ethers.parseEther(amountIn);

  try {
    let tokenInContract, tokenOutContract, tokenInAddress, tokenOutAddress;

    if(direction === "AtoB") {
      tokenInContract = tokenAContract;
      tokenOutContract = tokenBContract;
      tokenInAddress = tokenAAddress;
      tokenOutAddress = tokenBAddress;
    } else {
      tokenInContract = tokenBContract;
      tokenOutContract = tokenAContract;
      tokenInAddress = tokenBAddress;
      tokenOutAddress = tokenAAddress;
    }

    const allowance = await tokenInContract.allowance(userAddress, simpleSwapAddress);
    if (allowance < amountIn) {
      const txApprove = await tokenInContract.approve(simpleSwapAddress, amountIn);
      messagesDiv.textContent = "Approving tokens...";
      await txApprove.wait();
      messagesDiv.textContent = "Tokens approved";
    }

    const amountOutMin = 0;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const path = [tokenInAddress, tokenOutAddress];
    const txSwap = await simpleSwapContract.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      userAddress,
      deadline
    );
    messagesDiv.textContent = "Swapping tokens...";
    await txSwap.wait();
    messagesDiv.textContent = "Swap completed successfully!";
  } catch (err) {
    console.error(err);
    messagesDiv.textContent = "Swap failed: " + (err?.data?.message || err.message || err);
  }
}

connectBtn.onclick = connectWallet;
getPriceBtn.onclick = getPrice;
swapBtn.onclick = swapTokens;
