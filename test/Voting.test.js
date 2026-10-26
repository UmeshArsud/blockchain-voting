const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting v2", () => {
  let v, admin, a, b, outsider;
  beforeEach(async () => {
    [admin, a, b, outsider] = await ethers.getSigners();
    v = await (await ethers.getContractFactory("Voting")).deploy("Test");
    await v.addCandidate("Alice", "P1");
    await v.addCandidate("Bob", "P2");
    await v.connect(a).requestRegistration("A", "R1");
    await v.connect(b).requestRegistration("B", "R2");
  });

  it("only admin manages election and approvals", async () => {
    await expect(v.connect(a).addCandidate("X", "Y")).to.be.revertedWith("Only admin");
    await expect(v.connect(a).approveVoter(a.address)).to.be.revertedWith("Only admin");
  });
  it("admin cannot register as voter", async () => {
    await expect(v.requestRegistration("Admin", "R9")).to.be.revertedWith("Admin cannot be a voter");
  });
  it("blocks duplicate requests and duplicate IDs", async () => {
    await expect(v.connect(a).requestRegistration("A", "R5")).to.be.revertedWith("Already requested");
    await expect(v.connect(outsider).requestRegistration("O", "R1")).to.be.revertedWith("ID already used");
  });
  it("rejected voter can re-apply and ID is freed", async () => {
    await v.rejectVoter(a.address);
    await v.connect(a).requestRegistration("A fixed", "R1");
    expect((await v.getVoter(a.address)).status).to.equal(1);
  });
  it("pending voter cannot vote; approved voter votes once", async () => {
    await v.approveVoter(a.address);
    await v.startVoting();
    await expect(v.connect(b).vote(0)).to.be.revertedWith("Not a registered voter");
    await v.connect(a).vote(1);
    await expect(v.connect(a).vote(1)).to.be.revertedWith("Already voted");
    expect(await v.totalVotes()).to.equal(1);
  });
  it("cannot start without approved voters", async () => {
    await expect(v.startVoting()).to.be.revertedWith("Need 1+ approved voter");
  });
  it("registration closes once voting starts", async () => {
    await v.approveAllPending();
    await v.startVoting();
    await expect(v.connect(outsider).requestRegistration("O", "R7")).to.be.revertedWith("Wrong election phase");
  });
  it("declares the winner", async () => {
    await v.approveAllPending();
    await v.startVoting();
    await v.connect(a).vote(1);
    await v.connect(b).vote(1);
    await v.endVoting();
    const w = await v.winner();
    expect(w.name).to.equal("Bob");
    expect(w.votes).to.equal(2);
  });
});
