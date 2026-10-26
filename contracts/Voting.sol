// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BlockVote v2 - decentralized e-voting with voter self-registration
/// @notice Voters request registration, the admin approves/rejects, votes are public & immutable.
contract Voting {
    enum Phase { Registration, Voting, Ended }
    enum Status { None, Pending, Approved, Rejected }

    struct Candidate { uint256 id; string name; string party; uint256 votes; }
    struct Voter { address wallet; string name; string rollNo; Status status; }

    address public admin;
    string public title;
    Phase public phase;
    uint256 public totalVoters;
    uint256 public totalVotes;

    Candidate[] private candidates;
    mapping(address => Voter) private voters;
    address[] private voterList;
    mapping(bytes32 => address) private rollOwner; // one roll number = one wallet
    mapping(address => bool) public hasVoted;

    event CandidateAdded(uint256 indexed id, string name);
    event RegistrationRequested(address indexed voter, string rollNo);
    event VoterApproved(address indexed voter);
    event VoterRejected(address indexed voter);
    event PhaseChanged(Phase phase);
    event VoteCast(address indexed voter, uint256 indexed candidateId);

    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }
    modifier inPhase(Phase p) { require(phase == p, "Wrong election phase"); _; }

    constructor(string memory _title) { admin = msg.sender; title = _title; }

    // ---------- Admin: candidates ----------
    function addCandidate(string calldata name, string calldata party)
        external onlyAdmin inPhase(Phase.Registration)
    {
        require(bytes(name).length > 0, "Name required");
        uint256 id = candidates.length;
        candidates.push(Candidate(id, name, party, 0));
        emit CandidateAdded(id, name);
    }

    // ---------- Voter: self registration ----------
    function requestRegistration(string calldata name, string calldata rollNo)
        external inPhase(Phase.Registration)
    {
        require(msg.sender != admin, "Admin cannot be a voter");
        require(bytes(name).length > 0 && bytes(rollNo).length > 0, "Name and ID required");
        Status s = voters[msg.sender].status;
        require(s == Status.None || s == Status.Rejected, "Already requested");
        bytes32 h = keccak256(bytes(rollNo));
        require(rollOwner[h] == address(0), "ID already used");
        rollOwner[h] = msg.sender;
        if (s == Status.None) voterList.push(msg.sender);
        voters[msg.sender] = Voter(msg.sender, name, rollNo, Status.Pending);
        emit RegistrationRequested(msg.sender, rollNo);
    }

    // ---------- Admin: approve / reject ----------
    function approveVoter(address v) external onlyAdmin inPhase(Phase.Registration) {
        _approve(v);
    }

    function approveAllPending() external onlyAdmin inPhase(Phase.Registration) {
        for (uint256 i = 0; i < voterList.length; i++)
            if (voters[voterList[i]].status == Status.Pending) _approve(voterList[i]);
    }

    function rejectVoter(address v) external onlyAdmin inPhase(Phase.Registration) {
        require(voters[v].status == Status.Pending, "Not pending");
        voters[v].status = Status.Rejected;
        delete rollOwner[keccak256(bytes(voters[v].rollNo))]; // ID can be reused
        emit VoterRejected(v);
    }

    function _approve(address v) private {
        require(voters[v].status == Status.Pending, "Not pending");
        voters[v].status = Status.Approved;
        totalVoters++;
        emit VoterApproved(v);
    }

    // ---------- Election lifecycle ----------
    function startVoting() external onlyAdmin inPhase(Phase.Registration) {
        require(candidates.length >= 2, "Need 2+ candidates");
        require(totalVoters >= 1, "Need 1+ approved voter");
        phase = Phase.Voting;
        emit PhaseChanged(phase);
    }

    function vote(uint256 candidateId) external inPhase(Phase.Voting) {
        require(voters[msg.sender].status == Status.Approved, "Not a registered voter");
        require(!hasVoted[msg.sender], "Already voted");
        require(candidateId < candidates.length, "Invalid candidate");
        hasVoted[msg.sender] = true;
        candidates[candidateId].votes++;
        totalVotes++;
        emit VoteCast(msg.sender, candidateId);
    }

    function endVoting() external onlyAdmin inPhase(Phase.Voting) {
        phase = Phase.Ended;
        emit PhaseChanged(phase);
    }

    // ---------- Views ----------
    function getCandidates() external view returns (Candidate[] memory) { return candidates; }
    function getVoter(address a) external view returns (Voter memory) { return voters[a]; }
    function registered(address a) external view returns (bool) { return voters[a].status == Status.Approved; }

    function getVoters() external view returns (Voter[] memory list) {
        list = new Voter[](voterList.length);
        for (uint256 i = 0; i < voterList.length; i++) list[i] = voters[voterList[i]];
    }

    function winner() external view inPhase(Phase.Ended) returns (uint256 id, string memory name, uint256 votes) {
        uint256 best;
        for (uint256 i = 1; i < candidates.length; i++)
            if (candidates[i].votes > candidates[best].votes) best = i;
        Candidate memory c = candidates[best];
        return (c.id, c.name, c.votes);
    }
}
