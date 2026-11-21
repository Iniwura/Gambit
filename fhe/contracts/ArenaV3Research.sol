// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ArenaV3Research
 * @notice ISOLATED, UNDEPLOYED FHE RESEARCH CONTRACT, not production multiplayer.
 * Two distinct invited people may independently seal fresh PRIVATE 3v3 tactics
 * in each of five sequential rounds. Onchain users see ONLY proven per-round
 * aggregate reactor scores, cumulative totals, and final winner.
 *
 * Deliberate v3 policy differences from shipped SquadGambit:
 * - Both players seal new encrypted tactics EVERY round (not a reusable squad).
 * - Each may risk one publicly-declared GAMBIT activation per match. Which of
 *   three *visual lane sectors* they target stays ENCRYPTED. Use timing is public.
 * - Target win adds 2 points; target loss/draw subtracts 1, floored at zero.
 * - The v3 score range is 0..7 per side, NOT v2's 0..5.
 * - One-sided expiry ABORTS UNSCORED; no timeout creates a winner.
 * - A round with two on-time seals remains resolvable after its deadline.
 *
 * Not audited, cost/HCU not measured on Sepolia; not authorized for deployment.
 */
contract ArenaV3Research is ZamaEthereumConfig {
    uint8 public constant MAX_ROUNDS = 5;
    uint64 public constant ROUND_ENTRY_SECONDS = 1 days;

    struct Tactic {
        bool sealed;
        bool useGambit;
        uint64 sealedAt;
        euint8 formation;
        euint8 gambitSector; // 0..2 visual lane, encrypted; ignored if !useGambit
        euint8[3] base;
        euint8[3] trigger;
        euint8[3] response;
    }

    struct Round {
        uint64 openedAt;
        uint64 deadlineAt;
        bool resolved;
        bool finalized;
        uint8 packedScore;
        euint8 encryptedPackedScore;
        Tactic challenger;
        Tactic defender;
    }

    struct Match {
        address challenger;
        address defender;
        uint8 currentRound;
        bool complete;
        bool abandoned;
        bool challengerGambitSpent;
        bool defenderGambitSpent;
        uint16 cumulativeChallenger;
        uint16 cumulativeDefender;
    }

    uint256 public nextMatchId;
    mapping(uint256 => Match) private matches;
    mapping(uint256 => mapping(uint8 => Round)) private rounds;

    event MatchCreated(uint256 indexed matchId, address indexed challenger, address indexed defender);
    event RoundSealed(uint256 indexed matchId, uint8 indexed round, address indexed who);
    event RoundReady(uint256 indexed matchId, uint8 indexed round, bytes32 resultHandle);
    event RoundFinalized(
        uint256 indexed matchId, uint8 indexed round,
        uint8 challengerPoints, uint8 defenderPoints,
        uint16 cumulativeChallenger, uint16 cumulativeDefender
    );
    event MatchCompleted(uint256 indexed matchId, uint8 outcome);
    event MatchAbandonedUnscored(uint256 indexed matchId, uint8 indexed round);

    modifier liveMatch(uint256 id) {
        require(matches[id].challenger != address(0), "Unknown match");
        require(!matches[id].complete && !matches[id].abandoned, "Match closed");
        _;
    }

    function createMatch(address invitedDefender) external returns (uint256 id) {
        require(invitedDefender != address(0) && invitedDefender != msg.sender, "Invalid opponent");
        id = ++nextMatchId;
        Match storage m = matches[id];
        m.challenger = msg.sender;
        m.defender = invitedDefender;
        m.currentRound = 1;
        _openRound(id, 1);
        emit MatchCreated(id, msg.sender, invitedDefender);
    }

    /**
     * Ten encrypted squad inputs: 3 independent (base, trigger, response)
     * triples + encrypted formation. The 11th input is an encrypted GAMBIT
     * sector, used only when useGambit=true. The boolean useGambit is PUBLIC:
     * the chosen sector remains private but the round of use does not.
     */
    function sealRound(
        uint256 id, externalEuint8[11] calldata encrypted,
        bytes calldata inputProof, bool useGambit
    ) external liveMatch(id) {
        Match storage m = matches[id];
        require(msg.sender == m.challenger || msg.sender == m.defender, "Not participant");
        Round storage r = rounds[id][m.currentRound];
        require(block.timestamp <= r.deadlineAt, "Entry expired");
        require(!r.resolved && !r.finalized, "Round closed");
        bool isChallenger = msg.sender == m.challenger;
        Tactic storage p = isChallenger ? r.challenger : r.defender;
        require(!p.sealed, "Already sealed");
        if (useGambit) {
            if (isChallenger) {
                require(!m.challengerGambitSpent, "GAMBIT already spent");
                m.challengerGambitSpent = true;
            } else {
                require(!m.defenderGambitSpent, "GAMBIT already spent");
                m.defenderGambitSpent = true;
            }
        }
        p.useGambit = useGambit;
        p.formation = _normalize(FHE.fromExternal(encrypted[9], inputProof));
        FHE.allowThis(p.formation);
        if (useGambit) {
            p.gambitSector = _normalize(FHE.fromExternal(encrypted[10], inputProof));
            FHE.allowThis(p.gambitSector);
        }
        for (uint8 i = 0; i < 3; i++) {
            p.base[i] = _normalize(FHE.fromExternal(encrypted[uint256(i) * 3], inputProof));
            p.trigger[i] = _normalize(FHE.fromExternal(encrypted[uint256(i) * 3 + 1], inputProof));
            p.response[i] = _normalize(FHE.fromExternal(encrypted[uint256(i) * 3 + 2], inputProof));
            FHE.allowThis(p.base[i]);
            FHE.allowThis(p.trigger[i]);
            FHE.allowThis(p.response[i]);
        }
        p.sealed = true;
        p.sealedAt = uint64(block.timestamp);
        emit RoundSealed(id, m.currentRound, msg.sender);
    }

    function resolveRound(uint256 id) external liveMatch(id) {
        Match storage m = matches[id];
        Round storage r = rounds[id][m.currentRound];
        require(r.challenger.sealed && r.defender.sealed, "Both orders required");
        require(!r.resolved && !r.finalized, "Already resolved");

        ebool same = FHE.eq(r.challenger.formation, r.defender.formation);
        ebool shiftOne = FHE.or(
            FHE.or(
                FHE.and(FHE.eq(r.challenger.formation, FHE.asEuint8(0)), FHE.eq(r.defender.formation, FHE.asEuint8(1))),
                FHE.and(FHE.eq(r.challenger.formation, FHE.asEuint8(1)), FHE.eq(r.defender.formation, FHE.asEuint8(2)))
            ),
            FHE.and(FHE.eq(r.challenger.formation, FHE.asEuint8(2)), FHE.eq(r.defender.formation, FHE.asEuint8(0)))
        );

        ebool[3] memory winsA;
        ebool[3] memory winsBByRoleA;
        for (uint8 i = 0; i < 3; i++) {
            (winsA[i], winsBByRoleA[i]) = _lane(r.challenger, r.defender, i, same, shiftOne);
        }
        ebool[3] memory winsB;
        for (uint8 j = 0; j < 3; j++) {
            winsB[j] = FHE.select(same, winsBByRoleA[j],
                FHE.select(shiftOne, winsBByRoleA[(j + 2) % 3], winsBByRoleA[(j + 1) % 3]));
        }

        euint8 a = _points(r.challenger, winsA, winsB);
        euint8 b = _points(r.defender, winsB, winsA);
        r.encryptedPackedScore = FHE.add(FHE.shl(a, 3), b);
        FHE.allowThis(r.encryptedPackedScore);
        FHE.makePubliclyDecryptable(r.encryptedPackedScore);
        r.resolved = true;
        emit RoundReady(id, m.currentRound, FHE.toBytes32(r.encryptedPackedScore));
    }

    /**
     * Only a KMS signature over EXACTLY the stored round handle can finalize.
     * As with v2, callers may relay the proof, but cannot change its score.
     */
    function finalizeRound(uint256 id, uint8 packed, bytes calldata proof) external liveMatch(id) {
        Match storage m = matches[id];
        Round storage r = rounds[id][m.currentRound];
        require(r.resolved && !r.finalized, "Not finalizable");
        uint8 a = packed >> 3;
        uint8 b = packed & 7;
        require(a <= 7 && b <= 7, "Invalid v3 aggregate");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(r.encryptedPackedScore);
        FHE.checkSignatures(handles, abi.encode(packed), proof);

        r.finalized = true;
        r.packedScore = packed;
        m.cumulativeChallenger += a;
        m.cumulativeDefender += b;
        emit RoundFinalized(id, m.currentRound, a, b, m.cumulativeChallenger, m.cumulativeDefender);
        if (m.currentRound == MAX_ROUNDS) {
            m.complete = true;
            uint8 winner = m.cumulativeChallenger == m.cumulativeDefender ? 0 :
                m.cumulativeChallenger > m.cumulativeDefender ? 1 : 2;
            emit MatchCompleted(id, winner);
        } else {
            m.currentRound += 1;
            _openRound(id, m.currentRound);
        }
    }

    /**
     * Explicitly closes an INCOMPLETE round without an invented winner.
     * Anyone may invoke this ONLY after the entry deadline and ONLY if at
     * least one player did not seal. No instant replays or forfeiture wins.
     */
    function expireIncomplete(uint256 id) external liveMatch(id) {
        Match storage m = matches[id];
        Round storage r = rounds[id][m.currentRound];
        require(block.timestamp > r.deadlineAt, "Entry still open");
        require(!r.challenger.sealed || !r.defender.sealed, "Both sealed on time");
        require(!r.resolved && !r.finalized, "Already in settlement");
        m.abandoned = true;
        emit MatchAbandonedUnscored(id, m.currentRound);
    }

    function matchStatus(uint256 id) external view returns (
        address challenger, address defender, uint8 currentRound,
        bool complete, bool abandoned, bool challengerGambitSpent, bool defenderGambitSpent,
        uint16 cumulativeChallenger, uint16 cumulativeDefender
    ) {
        Match storage m = matches[id];
        require(m.challenger != address(0), "Unknown match");
        return (m.challenger, m.defender, m.currentRound, m.complete, m.abandoned,
            m.challengerGambitSpent, m.defenderGambitSpent,
            m.cumulativeChallenger, m.cumulativeDefender);
    }

    function roundStatus(uint256 id, uint8 round) external view returns (
        uint64 openedAt, uint64 deadlineAt, bool challengerSealed, bool defenderSealed,
        bool resolved, bool finalized, uint8 packedScore
    ) {
        require(matches[id].challenger != address(0) && round >= 1 && round <= MAX_ROUNDS, "Unknown round");
        Round storage r = rounds[id][round];
        require(r.openedAt != 0, "Round not opened");
        return (r.openedAt, r.deadlineAt, r.challenger.sealed,
            r.defender.sealed, r.resolved, r.finalized, r.packedScore);
    }

    function publicResultHandle(uint256 id, uint8 round) external view returns (bytes32) {
        require(matches[id].challenger != address(0) && round >= 1 && round <= MAX_ROUNDS, "Unknown round");
        Round storage r = rounds[id][round];
        require(r.resolved, "Result unavailable");
        return FHE.toBytes32(r.encryptedPackedScore);
    }

    function _openRound(uint256 id, uint8 round) private {
        Round storage r = rounds[id][round];
        r.openedAt = uint64(block.timestamp);
        r.deadlineAt = uint64(block.timestamp + ROUND_ENTRY_SECONDS);
    }

    function _normalize(euint8 input) private returns (euint8) {
        return FHE.select(FHE.lt(input, FHE.asEuint8(3)), input, FHE.asEuint8(1));
    }

    function _rotate(euint8[3] storage values, uint8 i, ebool same, ebool shiftOne)
        private returns (euint8)
    {
        return FHE.select(same, values[i], FHE.select(shiftOne,
            values[(uint256(i) + 1) % 3], values[(uint256(i) + 2) % 3]));
    }

    function _lane(Tactic storage a, Tactic storage b, uint8 i, ebool same, ebool shiftOne)
        private returns (ebool, ebool)
    {
        euint8 enemyBase = _rotate(b.base, i, same, shiftOne);
        euint8 enemyTrigger = _rotate(b.trigger, i, same, shiftOne);
        euint8 enemyResponse = _rotate(b.response, i, same, shiftOne);
        euint8 aAction = FHE.select(FHE.eq(a.trigger[i], enemyBase), a.response[i], a.base[i]);
        euint8 bAction = FHE.select(FHE.eq(enemyTrigger, a.base[i]), enemyResponse, enemyBase);
        ebool draw = FHE.eq(aAction, bAction);
        ebool aWins = FHE.or(
            FHE.or(
                FHE.and(FHE.eq(aAction, FHE.asEuint8(0)), FHE.eq(bAction, FHE.asEuint8(2))),
                FHE.and(FHE.eq(aAction, FHE.asEuint8(1)), FHE.eq(bAction, FHE.asEuint8(0)))
            ),
            FHE.and(FHE.eq(aAction, FHE.asEuint8(2)), FHE.eq(bAction, FHE.asEuint8(1)))
        );
        return (aWins, FHE.and(FHE.not(draw), FHE.not(aWins)));
    }

    function _points(Tactic storage t, ebool[3] memory own, ebool[3] memory other)
        private returns (euint8 score)
    {
        score = FHE.asEuint8(0);
        for (uint8 i = 0; i < 3; i++) {
            score = FHE.add(score, FHE.select(own[i], FHE.asEuint8(1), FHE.asEuint8(0)));
        }
        euint8 bonus = FHE.select(own[2], FHE.asEuint8(1), FHE.asEuint8(0));
        bonus = FHE.add(bonus,
            FHE.select(FHE.and(own[0], own[2]), FHE.asEuint8(1), FHE.asEuint8(0)));
        bonus = FHE.sub(bonus,
            FHE.select(FHE.and(other[1], own[2]), FHE.asEuint8(1), FHE.asEuint8(0)));
        score = FHE.add(score, bonus);
        if (t.useGambit) {
            ebool hit = _stakeHit(t, own);
            euint8 success = FHE.add(score, FHE.asEuint8(2));
            euint8 loss = FHE.select(FHE.eq(score, FHE.asEuint8(0)),
                FHE.asEuint8(0), FHE.sub(score, FHE.asEuint8(1)));
            score = FHE.select(hit, success, loss);
        }
    }

    /**
     * Sector is the VISUAL lane after secret formation rotation.
     * It is deliberately not a fixed role index.
     */
    function _stakeHit(Tactic storage t, ebool[3] memory wins) private returns (ebool hit) {
        ebool[3] memory formation;
        ebool[3] memory chosenSector;
        for (uint8 k = 0; k < 3; k++) {
            formation[k] = FHE.eq(t.formation, FHE.asEuint8(k));
            chosenSector[k] = FHE.eq(t.gambitSector, FHE.asEuint8(k));
        }
        hit = FHE.eq(FHE.asEuint8(0), FHE.asEuint8(1));
        for (uint8 role = 0; role < 3; role++) {
            ebool target = FHE.or(
                FHE.or(
                    FHE.and(formation[0], chosenSector[role]),
                    FHE.and(formation[1], chosenSector[(uint256(role) + 1) % 3])
                ),
                FHE.and(formation[2], chosenSector[(uint256(role) + 2) % 3])
            );
            hit = FHE.or(hit, FHE.and(target, wins[role]));
        }
    }
}
