#!/usr/bin/env node
const { MARKETS } = require("@project-serum/serum");
const web3 = require("@solana/web3.js");
const util = require("./util");

function loadMarkets() {
  return MARKETS.filter(({ name, deprecated }) => {
    const quoteSymbol = name.split("/")[1];
    return !deprecated && (quoteSymbol === "USDC" || quoteSymbol === "USDT");
  });
}

async function main() {
  const argv = await util.createYargsWithRpc().argv;

  const conn = new web3.Connection(argv.rpc);
  const markets = loadMarkets();
  // const markets = [{
  //   name: "IVN/USDC",
  //   address: new web3.PublicKey("4JDhmLVobWpUaV8tr3ZGAXmSp3vMf24a2D2dVfoH1E5T"),
  //   programId: new web3.PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"),
  // }];
  const table = await util.market.calculatePriceChange(conn, markets);
  console.log(table.toString());
}

main().then(
  () => {
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
