const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers");

describe("SimpleSwap", function() {
  let owner, user1, tokenA, tokenB, simpleSwap;

  beforeEach(async function() {
    [owner, user1] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    tokenA = await ERC20Mock.deploy("TokenA", "TKA", owner.address, parseEther("1000"));
    await tokenA.waitForDeployment();

    tokenB = await ERC20Mock.deploy("TokenB", "TKB", owner.address, parseEther("1000"));
    await tokenB.waitForDeployment();

    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    simpleSwap = await SimpleSwap.deploy(tokenA.target, tokenB.target); // Ethers v6 uses `.target`, not `.address`
    await simpleSwap.waitForDeployment();
  });

  describe("Deployment", function() {
    it("Should deploy with correct tokens", async function() {
      expect(await simpleSwap.token_A()).to.equal(tokenA.target);
      expect(await simpleSwap.token_B()).to.equal(tokenB.target);
    });

    it("Should revert with same tokens", async () => {
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      await expect(SimpleSwap.deploy(tokenA.target, tokenA.target)).to.be.revertedWith("tokens equals!");
    });
  });

  describe("addLiquidity", function() {
    it("Should add liquidity and mint LQP tokens", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const amountA = parseEther("100");
      const amountB = parseEther("200");

      await tokenA.connect(owner).approve(simpleSwap.target, amountA);
      await tokenB.connect(owner).approve(simpleSwap.target, amountB);

      const tx = await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        parseEther("90"),
        parseEther("180"),
        owner.address,
        deadline
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.eventName === "LiquidityAdded");
      expect(event.args.provider).to.equal(owner.address);
    });

    it("Should revert if deadline is passed", async () => {
      const pastDeadline = Math.floor(Date.now() / 1000) - 10;
      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          parseEther("1"),
          parseEther("1"),
          0,
          0,
          owner.address,
          pastDeadline
        )
      ).to.be.revertedWith("Transaction expired");
    });

    it("Should revert if recipient address is zero", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          parseEther("1"),
          parseEther("1"),
          0,
          0,
          ethers.ZeroAddress,
          deadline
        )
      ).to.be.revertedWith("Invalid 'to' address");
    });

    it("Should revert with invalid token pair", async () => {
      const FakeToken = await ethers.getContractFactory("ERC20Mock");
      const fakeToken = await FakeToken.deploy("Fake", "FAK", owner.address, parseEther("100"));
      await fakeToken.waitForDeployment();
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        simpleSwap.addLiquidity(
          fakeToken.target,
          tokenB.target,
          parseEther("1"),
          parseEther("1"),
          0,
          0,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Invalid token pair");
    });

    it("Should revert if optimal B is less than amountBMin", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await tokenA.connect(owner).approve(simpleSwap.target, parseEther("100"));
      await tokenB.connect(owner).approve(simpleSwap.target, parseEther("100"));

      //first add liquidity so reserves are not empty
      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        parseEther("100"),
        parseEther("100"),
        0,
        0,
        owner.address,
        deadline
      );

      // then add liquidity again with minimums not met
      await tokenA.connect(owner).approve(simpleSwap.target, parseEther("10"));
      await tokenB.connect(owner).approve(simpleSwap.target, parseEther("10"));

      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          parseEther("10"),
          parseEther("10"),
          parseEther("10"),
          parseEther("11"),
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Insufficient B amount");
    });

    it("Should revert if optimal A is less than amountAMin", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // First: add initial liquidity
      await tokenA.connect(owner).approve(simpleSwap.target, parseEther("100"));
      await tokenB.connect(owner).approve(simpleSwap.target, parseEther("200"));

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        parseEther("100"),
        parseEther("200"),
        0,
        0,
        owner.address,
        deadline
      );

      const desiredA = parseEther("10");
      const desiredB = parseEther("5");
      const amountAMin = parseEther("6");

      await tokenA.connect(owner).approve(simpleSwap.target, desiredA);
      await tokenB.connect(owner).approve(simpleSwap.target, desiredB);

      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          desiredA,
          desiredB,
          amountAMin,
          0,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Insufficient A amount");
    });

    it("Should calculate optimal amounts with adjusted optimalA path", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Paso 1: Liquidez inicial
      await tokenA.connect(owner).approve(simpleSwap.target, parseEther("100"));
      await tokenB.connect(owner).approve(simpleSwap.target, parseEther("200"));
      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        parseEther("100"),
        parseEther("200"),
        0,
        0,
        owner.address,
        deadline
      );

      // Paso 2: Forzar cálculo de optimalA (pasar más B de lo necesario)
      const desiredA = parseEther("5");
      const desiredB = parseEther("9"); // optimalB sería 10, así que 9 fuerza el else

      await tokenA.connect(owner).approve(simpleSwap.target, desiredA);
      await tokenB.connect(owner).approve(simpleSwap.target, desiredB);

      const tx = await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        desiredA,
        desiredB,
        0,
        0,
        owner.address,
        deadline
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "LiquidityAdded");

      expect(event.args.amountA).to.be.lt(desiredA); // se ajusta A
      expect(event.args.amountB).to.equal(desiredB); // mantiene B
    });

    it("Should calculate optimal amounts and take optimalB path", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Paso 1: agregar liquidez inicial
      await tokenA.connect(owner).approve(simpleSwap.target, parseEther("100"));
      await tokenB.connect(owner).approve(simpleSwap.target, parseEther("200"));
      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        parseEther("100"),
        parseEther("200"),
        0,
        0,
        owner.address,
        deadline
      );

      // Paso 2: preparar nuevo addLiquidity con desiredA y desiredB
      // Queremos que optimalB = (10 * 200) / 100 = 20
      // desiredB = 25 → entra en optimalB <= desiredB
      // minB = 19 → pasa el require(optimalB >= minB)

      const desiredA = parseEther("10");
      const desiredB = parseEther("25");
      const minB = parseEther("19");

      await tokenA.connect(owner).approve(simpleSwap.target, desiredA);
      await tokenB.connect(owner).approve(simpleSwap.target, desiredB);

      const tx = await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        desiredA,
        desiredB,
        0,
        minB,
        owner.address,
        deadline
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "LiquidityAdded");

      // 🔥 Validamos que amountA == desiredA y amountB == optimalB (20)
      expect(event.args.amountA).to.equal(desiredA);
      expect(event.args.amountB).to.equal(parseEther("20"));
    });



    it("Should allow adding liquidity with tokenA and tokenB in reverse order", async function() {
      const amountADesired = parseEther("100");
      const amountBDesired = parseEther("200");

      // Approve tokens in reverse order
      await tokenA.connect(owner).approve(simpleSwap.target, amountADesired);
      await tokenB.connect(owner).approve(simpleSwap.target, amountBDesired);

      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 1000;
      const tx = await simpleSwap.connect(owner).addLiquidity(
        tokenB.target, // tokenA parameter receives token_B
        tokenA.target, // tokenB parameter receives token_A
        amountADesired,
        amountBDesired,
        0,
        0,
        owner.address,
        deadline
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "LiquidityAdded");
      expect(event.args.amountA).to.equal(amountADesired);
      expect(event.args.amountB).to.equal(amountBDesired);

      expect(await tokenA.balanceOf(simpleSwap.target)).to.equal(amountADesired);
      expect(await tokenB.balanceOf(simpleSwap.target)).to.equal(amountBDesired);
    });
  });

  describe("removeLiquidity", function() {
    let deadline;

    beforeEach(async () => {
      deadline = Math.floor(Date.now() / 1000) + 3600;

      const amountA = parseEther("100");
      const amountB = parseEther("200");

      await tokenA.connect(owner).approve(simpleSwap.target, amountA);
      await tokenB.connect(owner).approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        0,
        0,
        owner.address,
        deadline
      );
    });

    it("Should remove liquidity and burn LQP tokens", async () => {
      const liquidity = await simpleSwap.balanceOf(owner.address);

      const tx = await simpleSwap.removeLiquidity(
        tokenA.target,
        tokenB.target,
        liquidity,
        0,
        0,
        owner.address,
        deadline
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "LiquidityRemoved");

      expect(event.args.provider).to.equal(owner.address);

      expect(event.args.amountA).to.be.gt(0);
      expect(event.args.amountB).to.be.gt(0);

      const balA = await tokenA.balanceOf(owner.address);
      const balB = await tokenB.balanceOf(owner.address);

      expect(balA).to.be.closeTo(parseEther("1000"), parseEther("0.01"));
      expect(balB).to.be.closeTo(parseEther("1000"), parseEther("0.01"));

      expect(await simpleSwap.balanceOf(owner.address)).to.equal(0);
    });

    it("Should revert if deadline is passed", async () => {
      const pastDeadline = Math.floor(Date.now() / 1000) - 10;
      const liquidity = await simpleSwap.balanceOf(owner.address);

      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          liquidity,
          0,
          0,
          owner.address,
          pastDeadline
        )
      ).to.be.revertedWith("Transaction expired");
    });

    it("Should revert if recipient address is zero", async () => {
      const liquidity = await simpleSwap.balanceOf(owner.address);

      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          liquidity,
          0,
          0,
          ethers.ZeroAddress,
          deadline
        )
      ).to.be.revertedWith("Invalid 'to' address");
    });

    it("Should revert if user does not have enough liquidity tokens", async () => {
      let liquidity = await simpleSwap.balanceOf(owner.address);
      liquidity = liquidity + 1n;

      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          liquidity,
          0,
          0,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Not enough liquidity");
    });

    it("Should revert if token pair is invalid", async () => {
      const FakeToken = await ethers.getContractFactory("ERC20Mock");
      const fakeToken = await FakeToken.deploy("Fake", "FAK", owner.address, parseEther("100"));
      await fakeToken.waitForDeployment();

      const liquidity = await simpleSwap.balanceOf(owner.address);

      await expect(
        simpleSwap.removeLiquidity(
          fakeToken.target,
          tokenB.target,
          liquidity,
          0,
          0,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Invalid token pair");
    });

    it("Should revert if slippage limit not met", async () => {
      const liquidity = await simpleSwap.balanceOf(owner.address);

      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          liquidity,
          parseEther("1000"),
          0,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Slippage limit");
    });

    it("Should remove liquidity correctly when tokenA and tokenB are passed in reverse order", async () => {
      const liquidity = await simpleSwap.balanceOf(owner.address);

      const tx = await simpleSwap.removeLiquidity(
        tokenB.target,
        tokenA.target,
        liquidity,
        0,
        0,
        owner.address,
        deadline
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "LiquidityRemoved");

      expect(event.args.provider).to.equal(owner.address);

      expect(event.args.amountA).to.be.gt(0);
      expect(event.args.amountB).to.be.gt(0);

      expect(await tokenA.balanceOf(simpleSwap.target)).to.equal(0);
      expect(await tokenB.balanceOf(simpleSwap.target)).to.equal(0);

      expect(await simpleSwap.balanceOf(owner.address)).to.equal(0);
    });

  });

  describe("swapExactTokensForTokens", function() {
    let deadline;

    beforeEach(async () => {
      deadline = Math.floor(Date.now() / 1000) + 3600;

      // Añadimos liquidez para que el swap funcione
      const amountA = parseEther("100");
      const amountB = parseEther("200");

      await tokenA.connect(owner).approve(simpleSwap.target, amountA);
      await tokenB.connect(owner).approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        0,
        0,
        owner.address,
        deadline
      );
    });

    it("Should swap exact tokenA for tokenB", async () => {
      const amountIn = parseEther("10");
      const amountOutMin = 0;

      await tokenA.connect(owner).approve(simpleSwap.target, amountIn);

      const path = [tokenA.target, tokenB.target];
      const balanceBefore = await tokenB.balanceOf(owner.address);

      const tx = await simpleSwap.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        owner.address,
        deadline
      );
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => log.fragment?.name === "TokensSwapped");
      expect(event.args.user).to.equal(owner.address);
      expect(event.args.tokenIn).to.equal(tokenA.target);
      expect(event.args.tokenOut).to.equal(tokenB.target);
      expect(event.args.amountIn).to.equal(amountIn);
      expect(event.args.amountOut).to.be.gt(0);

      const balanceAfter = await tokenB.balanceOf(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should swap exact tokenB for tokenA", async () => {
      const amountIn = parseEther("10");
      const amountOutMin = 0;

      await tokenB.connect(owner).approve(simpleSwap.target, amountIn);

      const path = [tokenB.target, tokenA.target];
      const balanceBefore = await tokenA.balanceOf(owner.address);

      const tx = await simpleSwap.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        owner.address,
        deadline
      );
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => log.fragment?.name === "TokensSwapped");
      expect(event.args.user).to.equal(owner.address);
      expect(event.args.tokenIn).to.equal(tokenB.target);
      expect(event.args.tokenOut).to.equal(tokenA.target);
      expect(event.args.amountIn).to.equal(amountIn);
      expect(event.args.amountOut).to.be.gt(0);

      const balanceAfter = await tokenA.balanceOf(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should revert if deadline has passed", async () => {
      const amountIn = parseEther("10");
      const amountOutMin = 0;
      const pastDeadline = Math.floor(Date.now() / 1000) - 10;

      await tokenA.connect(owner).approve(simpleSwap.target, amountIn);

      const path = [tokenA.target, tokenB.target];

      await expect(
        simpleSwap.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          owner.address,
          pastDeadline
        )
      ).to.be.revertedWith("Transaction expired");
    });

    it("Should revert if path length is invalid (not 2)", async () => {
      const amountIn = parseEther("10");
      const amountOutMin = 0;

      await tokenA.connect(owner).approve(simpleSwap.target, amountIn);

      const path = [tokenA.target]; // Invalid path length

      await expect(
        simpleSwap.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Invalid path length");
    });

    it("Should revert if token pair in path does not match pool tokens", async () => {
      const FakeToken = await ethers.getContractFactory("ERC20Mock");
      const fakeToken = await FakeToken.deploy("Fake", "FAK", owner.address, parseEther("100"));
      await fakeToken.waitForDeployment();

      const amountIn = parseEther("10");
      const amountOutMin = 0;

      await fakeToken.connect(owner).approve(simpleSwap.target, amountIn);

      const path = [fakeToken.target, tokenB.target];

      await expect(
        simpleSwap.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Invalid tokens");
    });

    it("Should revert if amountOut is less than amountOutMin", async () => {
      const amountIn = parseEther("10");
      // Setting amountOutMin very high to force revert
      const amountOutMin = parseEther("1000");

      await tokenA.connect(owner).approve(simpleSwap.target, amountIn);

      const path = [tokenA.target, tokenB.target];

      await expect(
        simpleSwap.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Insufficient output amount");
    });

    it("Should revert if 'to' address is zero", async () => {
      const amountIn = parseEther("10");
      const amountOutMin = 0;

      await tokenA.connect(owner).approve(simpleSwap.target, amountIn);

      const path = [tokenA.target, tokenB.target];

      await expect(
        simpleSwap.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          ethers.ZeroAddress,
          deadline
        )
      ).to.be.revertedWith("Invalid 'to' address");
    });

    it("Should swap tokens correctly even if tokenA and tokenB are passed in reverse order in path", async () => {
      const amountIn = parseEther("10");
      const amountOutMin = 0;

      // Primero aprueba tokens en orden invertido
      await tokenB.connect(owner).approve(simpleSwap.target, amountIn);

      // Path con tokens invertidos
      const path = [tokenB.target, tokenA.target];

      const balanceBefore = await tokenA.balanceOf(owner.address);

      const tx = await simpleSwap.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        owner.address,
        deadline
      );
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => log.fragment?.name === "TokensSwapped");
      expect(event.args.user).to.equal(owner.address);
      expect(event.args.tokenIn).to.equal(tokenB.target);
      expect(event.args.tokenOut).to.equal(tokenA.target);
      expect(event.args.amountIn).to.equal(amountIn);
      expect(event.args.amountOut).to.be.gt(0);

      const balanceAfter = await tokenA.balanceOf(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

  });

  describe("getPrice", function() {
    beforeEach(async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const amountA = parseEther("100");
      const amountB = parseEther("200");

      await tokenA.connect(owner).approve(simpleSwap.target, amountA);
      await tokenB.connect(owner).approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        0,
        0,
        owner.address,
        deadline
      );
    });



    it("Should return correct price for tokenA -> tokenB", async () => {
      const price = await simpleSwap.getPrice(tokenA.target, tokenB.target);
      expect(price).to.be.closeTo(parseEther("2"), parseEther("0.001"));
    });

    it("Should return correct price for tokenB -> tokenA", async () => {
      const price = await simpleSwap.getPrice(tokenB.target, tokenA.target);
      expect(price).to.be.closeTo(parseEther("0.5"), parseEther("0.001"));
    });



    it("Should revert on invalid token pair", async () => {
      const FakeToken = await ethers.getContractFactory("ERC20Mock");
      const fakeToken = await FakeToken.deploy("Fake", "FAK", owner.address, parseEther("100"));
      await fakeToken.waitForDeployment();

      await expect(
        simpleSwap.getPrice(fakeToken.target, tokenB.target)
      ).to.be.revertedWith("Invalid tokens");
    });

    it("Should revert with 'No liquidity' if no liquidity has been added", async () => {
      // Deploy a fresh SimpleSwap without adding liquidity
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      const emptySwap = await SimpleSwap.deploy(tokenA.target, tokenB.target);
      await emptySwap.waitForDeployment();

      // Try getting the price without any reserves
      await expect(
        emptySwap.getPrice(tokenA.target, tokenB.target)
      ).to.be.revertedWith("No liquidity");
    });
  });



  describe("getAmountOut", function() {
    it("Should return correct output amount for given reserves and input amount", async () => {
      const amountIn = parseEther("10");
      const reserveIn = parseEther("100");
      const reserveOut = parseEther("200");

      const amountOut = await simpleSwap.getAmountOut(amountIn, reserveIn, reserveOut);

      expect(amountOut).to.be.gt(0);
      expect(amountOut).to.be.lt(reserveOut);
    });

    it("Should revert if reserveIn or reserveOut is zero", async () => {
      await expect(simpleSwap.getAmountOut(parseEther("1"), 0, parseEther("100"))).to.be.reverted;
      await expect(simpleSwap.getAmountOut(parseEther("1"), parseEther("100"), 0)).to.be.reverted;
    });
  });


});