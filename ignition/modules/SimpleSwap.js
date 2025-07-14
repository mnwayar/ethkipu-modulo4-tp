const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SimpleSwapModule = buildModule("SimpleSwapModule", (deployer) => {
  const simpleSwap = deployer.contract("SimpleSwap", ['0x2d2B2C2af6f4F87E722E064dcD9fDd3F94ce7597','0xe7318ea312EE8b8faAD947136f4C1b0d75484667']);

  return { simpleSwap };
});

module.exports = SimpleSwapModule;