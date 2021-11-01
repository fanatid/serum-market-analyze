#!/usr/bin/env node
const { Market } = require("@project-serum/serum");
const web3 = require("@solana/web3.js");
const util = require("./util");

async function main() {
  const argv = await util
    .createYargsWithRpc()
    .option("dex", util.dex.createYargsOption())
    .option("tradeable", {
      description: "Tradeable token in Serum Dex",
      type: "string",
    })
    .option("lendable", {
      description: "Lendable token in Serum Dex",
      type: "string",
    })
    .option("price-change", {
      description: "Calculate price change",
      default: false,
      type: "boolean",
    })
    .option("threshold", util.market.createThresholdOption()).argv;

  const conn = new web3.Connection(argv.rpc);
  const chainId = await util.getChainId(conn);
  const tokenList = await util.getTokenList(chainId);
  const dex = new web3.PublicKey(argv.dex || util.dex.getAddress(chainId));

  const filters = [util.market.createFilter(dex)];
  if (argv.tradeable) {
    const pubkey = new web3.PublicKey(argv.tradeable);
    filters.push({
      memcmp: {
        offset: Market.getLayout(dex).offsetOf("baseMint"),
        bytes: pubkey.toBase58(),
      },
    });
  } else if (argv.lendable) {
    const pubkey = new web3.PublicKey(argv.lendable);
    filters.push({
      memcmp: {
        offset: Market.getLayout(dex).offsetOf("quoteMint"),
        bytes: pubkey.toBase58(),
      },
    });
  } else {
    throw new Error("`tradeable` or `lendable` should be provided");
  }

  const accounts = await conn.getProgramAccounts(dex, { filters });
  const markets = accounts
    .map(({ account, pubkey }) => ({
      address: pubkey.toBase58(),
      name: util.market.getName(dex, account, tokenList),
    }))
    .sort((m1, m2) => {
      if (m1 && m2) {
        return m1.name < m2.name ? -1 : 1;
      }
      if (m1 && !m2) {
        return -1;
      }
      if (!m1 && m2) {
        return 1;
      }
      throw new Error("unreachable");
    });

  if (argv["price-change"]) {
    const list = markets.map(({ address, name }) => ({
      name,
      address: new web3.PublicKey(address),
      programId: dex,
    }));
    const table = await util.market.calculatePriceChange(
      conn,
      list,
      argv.threshold
    );
    console.log(table.toString());
  } else {
    console.log(`Found ${markets.length} markets:`);
    for (const { address, name } of markets) {
      console.log(address, name);
    }
  }
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
