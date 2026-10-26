# BlockVote - Decentralized E-Voting dApp (Mini Project)

A blockchain based decentralized application for an e-voting system.
Votes are stored in an Ethereum smart contract (Solidity), not in a central database.

**Stack:** Solidity, Hardhat, Ethers.js v6, React (Vite), MetaMask.

## Why it is decentralized
- Voting logic and the vote tally live in the `Voting.sol` smart contract, copied on every node of the network.
- One wallet = one vote, enforced by the contract (`hasVoted` mapping). The admin cannot change votes.
- Every vote emits a `VoteCast` event, shown in the app as a public ledger with block number and transaction hash.
- The "Blockchain proof" panel shows the live network, latest block and contract address.

## Setup
Requirements: Node.js 18+ and the MetaMask browser extension.

```bash
# 1. in the project root
npm install
npm test                 # runs smart contract tests

# 2. terminal A - start a local blockchain (prints 20 test accounts)
npm run node

# 3. terminal B - deploy the contract (adds demo candidates and voters)
npm run deploy

# 4. terminal C - start the website
cd frontend
npm install
npm run dev              # open http://localhost:5173
```

## MetaMask setup (local network)
The website has a **Switch network** button that adds the Hardhat network for you.
Manual setup: RPC `http://127.0.0.1:8545`, Chain ID `31337`, symbol `ETH`.
Import accounts with the private keys printed by `npm run node` (MetaMask: Add wallet -> Import an account):
- Account #0 = **Admin**
- Accounts #1-#3 = **approved voters** (demo)
- Accounts #4-#5 = **pending requests** (demo - approve them as admin)
- Account #6 onwards = new voters: register them yourself from the website

## Features
- **Wallet login / logout** (MetaMask) with automatic role detection (Admin / Voter)
- **Voter self-registration:** name + college ID, then waiting for admin approval
- **Admin dashboard:** add candidates, approve / reject / approve-all voters, start and end the election
- **Confirmation dialogs** for every irreversible action (approve, start, end, cast vote)
- **Safety rules in the contract:** one wallet = one vote, one college ID = one wallet, admin cannot vote,
  registration closes when voting starts, rejected voters can re-apply
- **Live results,** turnout, tie detection and CSV download of the final result
- **Blockchain proof panel** and **public vote ledger** (block number + transaction hash)
- Wrong-network detection with one-click network switch

## Demo flow
1. Admin (Account #0): see 2 pending requests (#4, #5). Approve one, reject the other. Add candidates if needed.
2. New voter (Account #6): log in, fill name + ID, **Request registration**. Admin approves it.
3. Admin: **Start voting** (confirmation dialog).
4. Voters #1-#3 vote. Try voting twice, or voting with a pending account - the contract rejects it.
5. Admin: **End election**. Show the winner, the CSV download and the public ledger.

## Optional: public testnet (Sepolia)
Set `SEPOLIA_RPC` and `PRIVATE_KEY` environment variables, then `npm run deploy:sepolia`
and switch MetaMask to Sepolia.

## Project structure
```
contracts/Voting.sol     smart contract
scripts/deploy.js        deploys + writes ABI/address for the frontend
test/Voting.test.js      contract tests
frontend/src/App.jsx     React UI (MetaMask + ethers)
```
## Smart contract features
Phases , admin-only controls, voter whitelist, double-vote
prevention, events, automatic winner calculation.

## Future scope
Zero-knowledge ballots for vote secrecy, IPFS candidate profiles, Aadhaar/OTP based voter KYC, MySQL for off-chain analytics.
