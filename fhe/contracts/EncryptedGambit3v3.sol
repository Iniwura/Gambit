// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title GAMBIT 3v3 encrypted squad match
 * @notice Three private conditional tactics per player resolve lane-by-lane;
 * only the aggregate squad result is publicly decryptable.
 *
 * This is intentionally separate from the already deployed SealedGambit
 * research contract. It requires a future, explicitly approved deployment.
 */
contract EncryptedGambit3v3 is ZamaEthereumConfig {
    uint8 internal constant LANES = 3;
    uint8 internal constant DRAW = 0;
    uint8 internal constant CHALLENGER = 1;
    uint8 internal constant OPPONENT = 2;
    uint64 internal constant MATCH_WINDOW = 1 days;

    struct PrivateTactic { euint8 base; euint8 trigger; euint8 response; }
    struct SquadMatch {
        address challenger; address opponent; uint64 openedAt;
        bool challengerCommitted; bool opponentCommitted; bool resolved; bool finalized; bool expired;
        PrivateTactic[3] challengerSquad; PrivateTactic[3] opponentSquad;
        euint8 encryptedOutcome; uint8 publicOutcome;
    }

    uint256 public nextMatchId;
    mapping(uint256 => SquadMatch) private matches;

    event MatchOpened(uint256 indexed id, address indexed challenger, address indexed opponent);
    event SquadCommitted(uint256 indexed id, address indexed player);
    event OutcomeReady(uint256 indexed id, bytes32 encryptedOutcomeHandle);
    event MatchFinalized(uint256 indexed id, uint8 outcome);
    event MatchExpired(uint256 indexed id);

    function open(address opponent) external returns (uint256 id) {
        require(opponent != address(0) && opponent != msg.sender, "Invalid opponent");
        id = ++nextMatchId;
        SquadMatch storage m = matches[id];
        m.challenger = msg.sender; m.opponent = opponent; m.openedAt = uint64(block.timestamp);
        emit MatchOpened(id, msg.sender, opponent);
    }

    function commitSquad(
        uint256 id,
        externalEuint8[3] calldata bases,
        externalEuint8[3] calldata triggers,
        externalEuint8[3] calldata responses,
        bytes calldata proof
    ) external {
        SquadMatch storage m = matches[id];
        require(m.challenger != address(0), "Unknown match");
        require(!m.expired && !m.resolved && !m.finalized, "Closed");
        require(block.timestamp <= uint256(m.openedAt) + MATCH_WINDOW, "Expired");
        bool isChallenger = msg.sender == m.challenger;
        require(isChallenger || msg.sender == m.opponent, "Not a participant");
        require(isChallenger ? !m.challengerCommitted : !m.opponentCommitted, "Already committed");
        PrivateTactic[3] storage squad = isChallenger ? m.challengerSquad : m.opponentSquad;
        for (uint256 i = 0; i < LANES; i++) {
            squad[i].base = _normalize(FHE.fromExternal(bases[i], proof));
            squad[i].trigger = _normalize(FHE.fromExternal(triggers[i], proof));
            squad[i].response = _normalize(FHE.fromExternal(responses[i], proof));
            FHE.allowThis(squad[i].base); FHE.allowThis(squad[i].trigger); FHE.allowThis(squad[i].response);
        }
        if (isChallenger) m.challengerCommitted = true; else m.opponentCommitted = true;
        emit SquadCommitted(id, msg.sender);
    }

    function resolve(uint256 id) external {
        SquadMatch storage m = matches[id];
        require(!m.expired && !m.resolved && !m.finalized, "Closed");
        require(m.challengerCommitted && m.opponentCommitted, "Missing squad");
        euint8 challengerWins = FHE.asEuint8(0);
        euint8 opponentWins = FHE.asEuint8(0);
        for (uint256 i = 0; i < LANES; i++) {
            PrivateTactic storage a = m.challengerSquad[i];
            PrivateTactic storage b = m.opponentSquad[i];
            euint8 actionA = FHE.select(FHE.eq(a.trigger, b.base), a.response, a.base);
            euint8 actionB = FHE.select(FHE.eq(b.trigger, a.base), b.response, b.base);
            ebool laneDraw = FHE.eq(actionA, actionB);
            ebool aWins = FHE.or(
                FHE.or(
                    FHE.and(FHE.eq(actionA, FHE.asEuint8(0)), FHE.eq(actionB, FHE.asEuint8(2))),
                    FHE.and(FHE.eq(actionA, FHE.asEuint8(1)), FHE.eq(actionB, FHE.asEuint8(0)))
                ),
                FHE.and(FHE.eq(actionA, FHE.asEuint8(2)), FHE.eq(actionB, FHE.asEuint8(1)))
            );
            euint8 laneAWin = FHE.select(laneDraw, FHE.asEuint8(0), FHE.select(aWins, FHE.asEuint8(1), FHE.asEuint8(0)));
            euint8 laneBWin = FHE.select(laneDraw, FHE.asEuint8(0), FHE.select(aWins, FHE.asEuint8(0), FHE.asEuint8(1)));
            challengerWins = FHE.add(challengerWins, laneAWin);
            opponentWins = FHE.add(opponentWins, laneBWin);
        }
        ebool squadDraw = FHE.eq(challengerWins, opponentWins);
        ebool challengerVictory = FHE.gt(challengerWins, opponentWins);
        m.encryptedOutcome = FHE.select(squadDraw, FHE.asEuint8(DRAW),
            FHE.select(challengerVictory, FHE.asEuint8(CHALLENGER), FHE.asEuint8(OPPONENT)));
        FHE.allowThis(m.encryptedOutcome); FHE.makePubliclyDecryptable(m.encryptedOutcome);
        m.resolved = true;
        emit OutcomeReady(id, FHE.toBytes32(m.encryptedOutcome));
    }

    function finalize(uint256 id, uint8 outcome, bytes calldata decryptionProof) external {
        SquadMatch storage m = matches[id];
        require(m.resolved && !m.finalized && !m.expired, "Not finalizable");
        require(outcome <= OPPONENT, "Invalid outcome");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(m.encryptedOutcome);
        FHE.checkSignatures(handles, abi.encode(outcome), decryptionProof);
        m.finalized = true; m.publicOutcome = outcome;
        emit MatchFinalized(id, outcome);
    }

    function expireUncommitted(uint256 id) external {
        SquadMatch storage m = matches[id];
        require(m.challenger != address(0), "Unknown match");
        require(!m.expired && !m.resolved && !m.finalized, "Closed");
        require(!(m.challengerCommitted && m.opponentCommitted), "Both committed");
        require(block.timestamp > uint256(m.openedAt) + MATCH_WINDOW, "Still active");
        m.expired = true; emit MatchExpired(id);
    }

    function status(uint256 id) external view returns (
        address challenger, address opponent, bool challengerCommitted, bool opponentCommitted,
        bool resolved, bool finalized, bool expired, uint8 publicOutcome
    ) {
        SquadMatch storage m = matches[id];
        return (m.challenger, m.opponent, m.challengerCommitted, m.opponentCommitted,
            m.resolved, m.finalized, m.expired, m.publicOutcome);
    }

    function outcomeHandle(uint256 id) external view returns (bytes32) {
        SquadMatch storage m = matches[id];
        require(m.resolved && !m.expired, "Outcome not ready");
        return FHE.toBytes32(m.encryptedOutcome);
    }

    function _normalize(euint8 value) private returns (euint8) {
        return FHE.select(FHE.lt(value, FHE.asEuint8(3)), value, FHE.asEuint8(1));
    }
}
