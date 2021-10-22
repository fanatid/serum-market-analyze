#!/usr/bin/env node
const { MARKETS, Market } = require("@project-serum/serum");
const web3 = require("@solana/web3.js");
const Table = require("cli-table3");
const yargs = require("yargs");

function loadMarkets() {
  return MARKETS.filter(({ name, deprecated }) => {
    const quoteSymbol = name.split("/")[1];
    return !deprecated && (quoteSymbol === "USDC" || quoteSymbol === "USDT");
  });
}

function priceChange(orders, priceLot) {
  let [amount1, sizeTotal1] = [priceLot, 0];
  let [amount2, sizeTotal2] = [priceLot, 0];
  for (const order of orders) {
    if (amount1 > 0) {
      const sizeMax = amount1 / order.price;
      const size = Math.min(sizeMax, order.size);
      sizeTotal1 += size;
      amount1 -= size * order.price;
    }
    if (amount1 <= 0 && amount2 > 0) {
      const sizeMax = amount2 / order.price;
      const size = Math.min(sizeMax, order.size);
      sizeTotal2 += size;
      amount2 -= size * order.price;
      if (amount2 <= 0) {
        break;
      }
    }
  }
  const [price1, price2] = [priceLot / sizeTotal1, priceLot / sizeTotal2];
  return 1 - price1 / price2;
}

async function main() {
  const argv = await yargs(process.argv.slice(2))
    .help("help")
    .alias("help", "h")
    .option("rpc", {
      description: "JSON RPC URL",
      default: "https://solana-api.projectserum.com",
      type: "string",
      requiresArg: true,
    }).argv;

  const table = new Table({
    head: [
      "Market",
      "Address",
      "Price change for $10k (bid), %",
      "Price change for $10k (ask), %",
    ],
  });

  const conn = new web3.Connection(argv.rpc);

  const markets = loadMarkets();
  // const markets = [{
  //   name: "IVN/USDC",
  //   address: new web3.PublicKey("4JDhmLVobWpUaV8tr3ZGAXmSp3vMf24a2D2dVfoH1E5T"),
  //   programId: new web3.PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"),
  // }];
  for (const data of markets) {
    const market = await Market.load(conn, data.address, {}, data.programId);
    const [bidsOrderBook, asksOrderBook] = await Promise.all([
      market.loadBids(conn),
      market.loadAsks(conn),
    ]);
    const [bids, asks] = [Array.from(bidsOrderBook), Array.from(asksOrderBook)];

    const bidChange = Math.abs(priceChange(bids.reverse(), 10_000)) * 100;
    const askChange = Math.abs(priceChange(asks, 10_000)) * 100;

    table.push([
      data.name,
      market.address.toString(),
      bidChange.toFixed(2),
      askChange.toFixed(2),
    ]);
  }

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
