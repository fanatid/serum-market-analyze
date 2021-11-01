const bs58 = require("bs58");
const Table = require("cli-table3");
const yargs = require("yargs");
const { Market } = require("@project-serum/serum");
const { TokenListProvider } = require("@solana/spl-token-registry");

function createYargsWithRpc() {
  return yargs(process.argv.slice(2))
    .help("help")
    .alias("help", "h")
    .option("rpc", {
      description: "JSON RPC URL",
      default: "https://solana-api.projectserum.com",
      type: "string",
      requiresArg: true,
    });
}

const dex = {
  createYargsOption() {
    return {
      description: "Serum Dex Address",
      type: "string",
    };
  },
  getAddress(chainId) {
    const programId = {
      101: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      103: "DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY",
    }[chainId];
    if (programId === undefined) {
      throw new Error(`Unknown chainId: ${chainId}`);
    }

    return programId;
  },
};

const market = {
  createFilter(dexAddress) {
    return {
      memcmp: {
        offset: Market.getLayout(dexAddress).offsetOf("accountFlags"),
        bytes: bs58.encode(Buffer.from("0300000000000000", "hex")), // initialized + market
      },
    };
  },
  getName(dexAddress, marketAccount, tokenList) {
    const data = Market.getLayout(dexAddress).decode(marketAccount.data);
    const baseAddress = data.baseMint.toBase58();
    const base = tokenList.find(({ address }) => address === baseAddress);
    const quoteAddress = data.quoteMint.toBase58();
    const quote = tokenList.find(({ address }) => address === quoteAddress);
    return `${base?.name || baseAddress}/${quote?.name || quoteAddress}`;
  },
  _priceChange(orders, priceLot) {
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
  },
  // Markets example
  // [{
  //   name: "IVN/USDC",
  //   address: new web3.PublicKey("4JDhmLVobWpUaV8tr3ZGAXmSp3vMf24a2D2dVfoH1E5T"),
  //   programId: new web3.PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"),
  // }];
  async calculatePriceChange(conn, markets) {
    const table = new Table({
      head: [
        "Market",
        "Address",
        "Price change for $10k (bid), %",
        "Price change for $10k (ask), %",
      ],
    });

    for (const data of markets) {
      const market = await Market.load(conn, data.address, {}, data.programId);
      const [bidsOrderBook, asksOrderBook] = await Promise.all([
        market.loadBids(conn),
        market.loadAsks(conn),
      ]);
      const [bids, asks] = [
        Array.from(bidsOrderBook),
        Array.from(asksOrderBook),
      ];

      const bidChange =
        Math.abs(this._priceChange(bids.reverse(), 10_000)) * 100;
      const askChange = Math.abs(this._priceChange(asks, 10_000)) * 100;

      table.push([
        data.name,
        market.address.toString(),
        bidChange.toFixed(2),
        askChange.toFixed(2),
      ]);
    }

    return table;
  },
};

async function getChainId(conn) {
  const genesis = await conn.getGenesisHash();

  const chainId = {
    "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": 101, // Mainnet
    "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY": 102, // Testnet
    EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: 103, // Devnet
  }[genesis];
  if (chainId === undefined) {
    throw new Error(`Unknown genesis hash: ${genesis}`);
  }

  return chainId;
}

async function getTokenList(chainId) {
  const tokens = await new TokenListProvider().resolve();
  return tokens.filterByChainId(chainId).getList();
}

module.exports = {
  createYargsWithRpc,
  dex,
  market,
  getChainId,
  getTokenList,
};
