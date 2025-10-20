/*
  Простой релэйер для учебного проекта:
  - слушает события Deposited в исходной сети
  - вызывает fulfill в целевой сети
  - ведёт локальное состояние (JSON) для идемпотентности
*/
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const STATE_PATH = path.join(process.cwd(), "relayer_state.json");

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    const json = JSON.parse(raw);
    return new Set(json.processed || []);
  } catch {
    return new Set();
  }
}

function saveState(set) {
  const payload = { processed: Array.from(set) };
  fs.writeFileSync(STATE_PATH, JSON.stringify(payload, null, 2));
}

async function main() {
  const srcRpc = process.env.SRC_RPC || "http://127.0.0.1:8545";
  const dstRpc = process.env.DST_RPC || "http://127.0.0.1:8545";
  const srcBridge = process.env.SRC_BRIDGE || process.env.BRIDGE_ADDRESS; // для простоты можно переиспользовать локальный мост
  const dstBridge = process.env.DST_BRIDGE || process.env.BRIDGE_ADDRESS;
  const relayerKey = process.env.RELAYER_KEY; // приватный ключ релэера (д.б. в allowlist на dst мосте)

  if (!srcBridge || !dstBridge) throw new Error("Set SRC_BRIDGE and DST_BRIDGE (или BRIDGE_ADDRESS для обоих)");
  if (!relayerKey) throw new Error("Set RELAYER_KEY (приватный ключ релэера для целевой сети)");

  const srcProvider = new ethers.JsonRpcProvider(srcRpc);
  const dstProvider = new ethers.JsonRpcProvider(dstRpc);
  const relayer = new ethers.Wallet(relayerKey, dstProvider);

  const bridgeAbi = require("../artifacts/contracts/SimpleBridge.sol/SimpleBridge.json").abi;
  const src = new ethers.Contract(srcBridge, bridgeAbi, srcProvider);
  const dst = new ethers.Contract(dstBridge, bridgeAbi, relayer);

  const processed = loadState();

  console.log("Relayer started");
  console.log("SRC:", srcRpc, srcBridge);
  console.log("DST:", dstRpc, dstBridge);
  console.log("Relayer:", await relayer.getAddress());

  // обработчик одного события
  async function handleDeposited(from, to, amount, dstChainId, depositId, event) {
    try {
      const idHex = ethers.hexlify(depositId);
      console.log("Deposited event:", { from, to, amount: amount.toString(), dstChainId: Number(dstChainId), depositId: idHex });

      if (processed.has(idHex)) {
        console.log("Skip: already processed (local)", idHex);
        return;
      }

      const already = await dst.isProcessed(depositId);
      if (already) {
        console.log("Skip: already processed (on-chain)", idHex);
        processed.add(idHex);
        saveState(processed);
        return;
      }

      console.log("Calling fulfill on dst...");
      const tx = await dst.fulfill(to, amount, depositId);
      console.log("tx sent:", tx.hash);
      const rcpt = await tx.wait();
      console.log("tx confirmed in", rcpt.blockNumber);

      processed.add(idHex);
      saveState(processed);
    } catch (e) {
      console.error("Error while fulfilling:", e.message || e);
    }
  }

  // подпишемся на события Deposited
  src.on("Deposited", handleDeposited);

  // также подтянем последние (например, за 1000 блоков), чтобы обработать пропущенные
  try {
    const current = await srcProvider.getBlockNumber();
    const fromBlock = Math.max(0, current - 1000);
    const filter = src.filters.Deposited();
    const logs = await src.queryFilter(filter, fromBlock, current);
    for (const log of logs) {
      const { args } = log;
      await handleDeposited(args.from, args.to, args.amount, args.dstChainId, args.depositId, log);
    }
  } catch (e) {
    console.warn("Initial catch-up failed:", e.message || e);
  }

  console.log("Listening for new Deposited events...");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


