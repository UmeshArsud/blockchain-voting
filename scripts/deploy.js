const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const signers = await hre.ethers.getSigners();
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy("Student Council Election 2026");
  await voting.waitForDeployment();
  const address = await voting.getAddress();
  const { chainId } = await hre.ethers.provider.getNetwork();
  console.log("Voting contract deployed to:", address);

  // Demo data (local network only)
  if (["localhost", "hardhat"].includes(hre.network.name)) {
    for (const [n, p] of [
      ["Aarav Sharma", "Innovation Panel"],
      ["Priya Kulkarni", "Unity Alliance"],
      ["Rohan Patil", "Campus First"],
    ]) await (await voting.addCandidate(n, p)).wait();
    // Accounts #1-#5 request registration; #1-#3 approved, #4-#5 left pending for the demo
    for (let i = 1; i <= 5; i++)
      await (await voting.connect(signers[i]).requestRegistration(`Demo Voter ${i}`, `CE2026-00${i}`)).wait();
    for (let i = 1; i <= 3; i++) await (await voting.approveVoter(signers[i].address)).wait();
    console.log("Demo: accounts #1-#3 approved, #4-#5 pending approval.");
  }

  const abi = JSON.parse(voting.interface.formatJson());
  fs.writeFileSync(
    path.join(__dirname, "../frontend/src/contract.json"),
    JSON.stringify({ address, chainId: Number(chainId), abi }, null, 2)
  );
  console.log("Address + ABI written to frontend/src/contract.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
