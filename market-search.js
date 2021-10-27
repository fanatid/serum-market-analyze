#!/usr/bin/env node
const bs58 = require("bs58");
const { Market } = require("@project-serum/serum");
const web3 = require("@solana/web3.js");
const yargs = require("yargs");

async function main() {
  const argv = await yargs(process.argv.slice(2))
    .help("help")
    .alias("help", "h")
    .option("rpc", {
      description: "JSON RPC URL",
      default: "https://solana-api.projectserum.com",
      type: "string",
      requiresArg: true,
    })
    .option("dex", {
      description: "Serum Dex Address",
      default: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      type: "string",
      requiresArg: true,
    })
    .option("token", {
      description: "Tradeable token in Serum Dex",
      type: "string",
      requiresArg: true,
    }).argv;

  const conn = new web3.Connection(argv.rpc);
  const dex = new web3.PublicKey(argv.dex);
  const token = new web3.PublicKey(argv.token);

  const accounts = await conn.getProgramAccounts(dex, {
    filters: [
      { dataSize: 388 },
      {
        memcmp: {
          offset: Market.getLayout(dex).offsetOf("accountFlags"),
          bytes: bs58.encode(Buffer.from("0300000000000000", "hex")), // initialized + market
        },
      },
      {
        memcmp: {
          offset: Market.getLayout(dex).offsetOf("baseMint"),
          bytes: token.toBase58(),
        },
      },
    ],
  });
  console.log(`Found ${accounts.length} accounts:`);
  for (const account of accounts) {
    console.log(account.pubkey.toBase58());
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
