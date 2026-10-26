import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import deployed from "./contract.json";

const PHASES = ["Registration open", "Voting open", "Election ended"];
const STATUS = ["Not registered", "Pending approval", "Approved", "Rejected"];
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function App() {
  const [account, setAccount] = useState("");
  const [net, setNet] = useState(null);
  const [block, setBlock] = useState(0);
  const [info, setInfo] = useState(null);
  const [cands, setCands] = useState([]);
  const [voters, setVoters] = useState([]);
  const [me, setMe] = useState({ status: 0, voted: false });
  const [ledger, setLedger] = useState([]);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [cName, setCName] = useState("");
  const [cParty, setCParty] = useState("");
  const [rName, setRName] = useState("");
  const [rRoll, setRRoll] = useState("");

  const ready = deployed.address && deployed.abi.length > 0;
  const wrongNet = net && deployed.chainId && net.chainId !== deployed.chainId;

  const getContract = useCallback(async (signer) => {
    const provider = new BrowserProvider(window.ethereum);
    return { provider, c: new Contract(deployed.address, deployed.abi, signer ? await provider.getSigner() : provider) };
  }, []);

  const refresh = useCallback(async () => {
    if (!ready || !window.ethereum) return;
    try {
      const { provider, c } = await getContract(false);
      const n = await provider.getNetwork();
      setNet({ name: n.name === "unknown" ? "Local chain" : n.name, chainId: Number(n.chainId) });
      if (deployed.chainId && Number(n.chainId) !== deployed.chainId) return;
      const [blk, title, phase, tv, tvotes, admin, list, vlist] = await Promise.all([
        provider.getBlockNumber(), c.title(), c.phase(), c.totalVoters(), c.totalVotes(), c.admin(), c.getCandidates(), c.getVoters(),
      ]);
      setBlock(blk);
      setInfo({ title, phase: Number(phase), totalVoters: Number(tv), totalVotes: Number(tvotes), admin });
      setCands(list.map((x) => ({ id: Number(x.id), name: x.name, party: x.party, votes: Number(x.votes) })));
      setVoters(vlist.map((v) => ({ wallet: v.wallet, name: v.name, rollNo: v.rollNo, status: Number(v.status) })));
      const logs = await c.queryFilter(c.filters.VoteCast());
      setLedger(logs.map((l) => ({ voter: l.args[0], cid: Number(l.args[1]), tx: l.transactionHash, block: l.blockNumber })).reverse());
      if (account) {
        const me = await c.getVoter(account);
        setMe({ status: Number(me.status), voted: await c.hasVoted(account) });
      }
    } catch {
      setMsg({ text: "Cannot read the contract. Run `npm run deploy` again and refresh.", type: "err" });
    }
  }, [account, ready, getContract]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((a) => a[0] && setAccount(a[0]));
    window.ethereum.on?.("accountsChanged", (a) => setAccount(a[0] || ""));
    window.ethereum.on?.("chainChanged", () => window.location.reload());
  }, []);

  async function connect() {
    if (!window.ethereum) return setMsg({ text: "MetaMask not found. Install the MetaMask browser extension.", type: "err" });
    const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accs[0]);
  }

  async function switchNetwork() {
    const chainId = "0x" + deployed.chainId.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    } catch {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId, chainName: "Hardhat Local", rpcUrls: ["http://127.0.0.1:8545"], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }],
      });
    }
  }

  async function send(label, fn) {
    setBusy(true);
    setMsg({ text: `${label}: confirm in MetaMask…`, type: "" });
    try {
      const { c } = await getContract(true);
      const tx = await fn(c);
      setMsg({ text: `Transaction sent (${short(tx.hash)}). Waiting for the block to be mined…`, type: "" });
      await tx.wait();
      setMsg({ text: `${label} confirmed on the blockchain.`, type: "ok" });
      await refresh();
      setBusy(false);
      return true;
    } catch (e) {
      setMsg({ text: e.reason || e.shortMessage || e.message, type: "err" });
      setBusy(false);
      return false;
    }
  }

  const ask = (title, body, fn) => setConfirm({ title, body, fn });
  const isAdmin = info && account && info.admin.toLowerCase() === account.toLowerCase();
  const total = cands.reduce((s, c) => s + c.votes, 0);
  const top = cands.length ? Math.max(...cands.map((c) => c.votes)) : 0;
  const nameOf = (id) => cands.find((c) => c.id === id)?.name ?? `#${id}`;
  const pending = voters.filter((v) => v.status === 1);

  function exportCsv() {
    const rows = [["Candidate", "Party", "Votes"], ...cands.map((c) => [c.name, c.party, c.votes])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "election-results.csv" }).click();
  }

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>BlockVote</h1>
          <p className="sub">{info ? info.title : "Decentralized e-voting on Ethereum"}</p>
        </div>
        {account ? (
          <div className="wallet">
            <span className="dot" /> {short(account)}
            {isAdmin ? <b className="badge">Admin</b> : info && <b className="badge soft">{STATUS[me.status]}</b>}
            <button className="link" onClick={() => setAccount("")}>Log out</button>
          </div>
        ) : (
          <button className="btn" onClick={connect}>Log in with MetaMask</button>
        )}
      </header>

      {!ready && <div className="note err">No contract found. Run <code>npm run deploy</code> in the project root first.</div>}
      {wrongNet && (
        <div className="note err">
          MetaMask is on the wrong network (chain {net.chainId}). This election runs on chain {deployed.chainId}.{" "}
          <button className="btn" onClick={switchNetwork}>Switch network</button>
        </div>
      )}
      {msg.text && <div className={`note ${msg.type}`}>{msg.text}</div>}

      {info && !wrongNet && (
        <>
          <section className="status">
            <div><span>Phase</span><strong>{PHASES[info.phase]}</strong></div>
            <div><span>Approved voters</span><strong>{info.totalVoters}</strong></div>
            <div><span>Votes cast</span><strong>{info.totalVotes}</strong></div>
            <div><span>Turnout</span><strong>{info.totalVoters ? Math.round((info.totalVotes / info.totalVoters) * 100) : 0}%</strong></div>
          </section>

          {info.phase === 2 && total > 0 && (
            <div className="winner">
              {cands.filter((c) => c.votes === top).length > 1 ? "Tie between " : "Winner: "}
              <b>{cands.filter((c) => c.votes === top).map((c) => c.name).join(" & ")}</b> with {top} vote{top !== 1 && "s"}
              <button className="btn light" onClick={exportCsv}>Download results (CSV)</button>
            </div>
          )}

          <main className="grid">
            <section className="ballot">
              <h2>Ballot</h2>
              {!account && <p className="muted">Log in with your wallet to register or vote. Your wallet address is your voter ID.</p>}
              {me.voted && <p className="stamp">Your vote is on the blockchain</p>}
              {cands.length === 0 && <p className="muted">No candidates yet. The admin adds them during registration.</p>}
              {cands.map((c) => {
                const pct = total ? Math.round((c.votes / total) * 100) : 0;
                const canVote = info.phase === 1 && me.status === 2 && !me.voted && !isAdmin;
                return (
                  <div className="cand" key={c.id}>
                    <div className="row">
                      <div><h3>{c.name}</h3><span className="muted">{c.party || "Independent"}</span></div>
                      {canVote && (
                        <button className="btn" disabled={busy} onClick={() => ask("Confirm your vote", `You are voting for ${c.name}. A vote is permanent and cannot be changed or withdrawn.`, () => send("Vote cast", (k) => k.vote(c.id)))}>Vote</button>
                      )}
                    </div>
                    <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                    <small>{c.votes} vote{c.votes !== 1 && "s"} · {pct}%</small>
                  </div>
                );
              })}
            </section>

            <aside>
              {account && !isAdmin && (
                <section className="panel">
                  <h2>Voter registration</h2>
                  {me.status === 2 && <p className="okline">You are an approved voter.{info.phase === 0 && " Voting opens when the admin starts the election."}</p>}
                  {me.status === 1 && <p className="muted">Your request is waiting for admin approval.</p>}
                  {(me.status === 0 || me.status === 3) && info.phase === 0 && (
                    <>
                      {me.status === 3 && <p className="errline">Your request was rejected. Check your details and apply again.</p>}
                      <label>Full name</label>
                      <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="As on your college ID" />
                      <label>College ID / roll number</label>
                      <input value={rRoll} onChange={(e) => setRRoll(e.target.value)} placeholder="e.g. CE2026-014" />
                      <button className="btn" disabled={busy || !rName.trim() || !rRoll.trim()} onClick={() => send("Registration request", (k) => k.requestRegistration(rName.trim(), rRoll.trim())).then((ok) => ok && (setRName(""), setRRoll("")))}>Request registration</button>
                    </>
                  )}
                  {(me.status === 0 || me.status === 3) && info.phase !== 0 && <p className="muted">Registration is closed for this election.</p>}
                </section>
              )}

              {isAdmin && (
                <section className="panel">
                  <h2>Admin controls</h2>
                  {info.phase === 0 && (
                    <>
                      <label>Add candidate</label>
                      <input placeholder="Full name" value={cName} onChange={(e) => setCName(e.target.value)} />
                      <input placeholder="Party / panel" value={cParty} onChange={(e) => setCParty(e.target.value)} />
                      <button className="btn ghost" disabled={busy || !cName.trim()} onClick={() => send("Candidate added", (c) => c.addCandidate(cName.trim(), cParty.trim())).then((ok) => ok && (setCName(""), setCParty("")))}>Add candidate</button>
                      <p className="muted">{cands.length} candidate(s), {pending.length} request(s) pending.</p>
                      <button className="btn dark" disabled={busy} onClick={() => ask("Start voting?", `Registration will close and voting will open for ${info.totalVoters} approved voter(s). Candidates and voter list can no longer change.`, () => send("Voting started", (c) => c.startVoting()))}>Start voting</button>
                    </>
                  )}
                  {info.phase === 1 && (
                    <button className="btn dark" disabled={busy} onClick={() => ask("End the election?", `${info.totalVotes} of ${info.totalVoters} voters have voted. Voting will close permanently and the result becomes final.`, () => send("Election ended", (c) => c.endVoting()))}>End election</button>
                  )}
                  {info.phase === 2 && <p className="muted">The election is closed. Results are final and cannot be changed.</p>}
                </section>
              )}

              <section className="panel chain">
                <h2>Blockchain proof</h2>
                <dl>
                  <dt>Network</dt><dd>{net?.name} (id {net?.chainId})</dd>
                  <dt>Latest block</dt><dd>#{block}</dd>
                  <dt>Contract</dt><dd className="mono">{deployed.address}</dd>
                  <dt>Admin</dt><dd className="mono">{info.admin}</dd>
                </dl>
                <p className="muted">No central server stores votes. Every node on the network holds a copy of this contract and its tally.</p>
              </section>
            </aside>
          </main>

          {isAdmin && (
            <section className="panel">
              <div className="row">
                <h2>Voter requests ({voters.length})</h2>
                {info.phase === 0 && pending.length > 0 && (
                  <button className="btn" disabled={busy} onClick={() => ask("Approve all pending?", `${pending.length} pending voter(s) will be approved. Check names and IDs first.`, () => send("Voters approved", (c) => c.approveAllPending()))}>Approve all ({pending.length})</button>
                )}
              </div>
              {voters.length === 0 ? <p className="muted">No one has requested registration yet.</p> : (
                <div className="scroll">
                  <table>
                    <thead><tr><th>Name</th><th>College ID</th><th>Wallet</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {voters.map((v) => (
                        <tr key={v.wallet}>
                          <td>{v.name}</td><td>{v.rollNo}</td><td className="mono">{short(v.wallet)}</td>
                          <td><span className={`pill s${v.status}`}>{STATUS[v.status]}</span></td>
                          <td className="acts">
                            {v.status === 1 && info.phase === 0 && (
                              <>
                                <button className="btn sm" disabled={busy} onClick={() => ask("Approve voter?", `${v.name} (${v.rollNo}) will be allowed to vote.`, () => send("Voter approved", (c) => c.approveVoter(v.wallet)))}>Approve</button>
                                <button className="btn sm ghost" disabled={busy} onClick={() => ask("Reject request?", `${v.name} (${v.rollNo}) will be rejected and may apply again.`, () => send("Voter rejected", (c) => c.rejectVoter(v.wallet)))}>Reject</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <section className="panel ledger">
            <h2>Public vote ledger</h2>
            {ledger.length === 0 ? <p className="muted">No votes recorded yet.</p> : (
              <div className="scroll">
                <table>
                  <thead><tr><th>Block</th><th>Voter wallet</th><th>Voted for</th><th>Transaction hash</th></tr></thead>
                  <tbody>
                    {ledger.map((l) => (
                      <tr key={l.tx}><td>#{l.block}</td><td className="mono">{short(l.voter)}</td><td>{nameOf(l.cid)}</td><td className="mono">{short(l.tx)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {confirm && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>{confirm.title}</h2>
            <p>{confirm.body}</p>
            <div className="mrow">
              <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn" onClick={() => { const f = confirm.fn; setConfirm(null); f(); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
