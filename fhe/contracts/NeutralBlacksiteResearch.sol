// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/** UNDEPLOYED five-slot neutral BLACKSITE research candidate.
 * No warden, caller-selected secret, financial reward or ranking.
 * Only authenticated feedback is scored; public feedback intentionally leaks clues.
 * Encrypted randomness and ACL security depend on the actual Zama network.
 */
contract NeutralBlacksiteResearch is ZamaEthereumConfig {
    uint8 public constant CODE_LENGTH = 5;
    uint8 public constant MAX_ATTEMPTS = 4;
    uint64 public constant MISSION_WINDOW = 1 days;
    uint64 public constant RECOVERY_GRACE = 1 days;
    uint8 private constant PROBE_BASE = 16;
    uint8 private constant BREACH_BASE = 64;

    struct Attempt {
        bool submitted;
        bool resolved;
        bool finalized;
        euint8[5] guess;
        euint8 approach;
        euint8 encryptedFeedback;
        uint8 publicFeedback;
    }
    struct Mission {
        address operative;
        uint64 openedAt;
        uint64 deadlineAt;
        uint64 recoveryDeadlineAt;
        uint8 attemptsUsed;
        uint8 heat;
        uint8 score;
        uint8 outcome; // 0 active, 1 breached, 2 locked, 3 expired, 4 technical abort
        euint8[5] vaultCode;
        Attempt[4] attempts;
    }
    uint256 public nextMissionId;
    mapping(address => uint256) public activeMission;
    mapping(uint256 => Mission) private missions;

    event MissionOpened(uint256 indexed missionId, address indexed operative);
    event AttemptSubmitted(uint256 indexed missionId, uint8 indexed attempt);
    event AttemptReady(uint256 indexed missionId, uint8 indexed attempt, bytes32 feedbackHandle);
    event AttemptFinalized(uint256 indexed missionId, uint8 indexed attempt, uint8 publicFeedback, uint8 heat, uint8 score);
    event MissionCompleted(uint256 indexed missionId, uint8 outcome, uint8 score, uint8 heat);
    event MissionExpired(uint256 indexed missionId);
    event MissionTechnicalAbort(uint256 indexed missionId, uint8 pendingAttempt);

    function openMission() external returns (uint256 id) {
        require(activeMission[msg.sender] == 0, "Existing active mission");
        id = ++nextMissionId;
        Mission storage m = missions[id];
        m.operative = msg.sender;
        m.openedAt = uint64(block.timestamp);
        m.deadlineAt = uint64(block.timestamp + MISSION_WINDOW);
        m.recoveryDeadlineAt = uint64(block.timestamp + MISSION_WINDOW + RECOVERY_GRACE);
        activeMission[msg.sender] = id;
        for (uint8 i = 0; i < CODE_LENGTH; i++) {
            m.vaultCode[i] = FHE.randEuint8(4);
            FHE.allowThis(m.vaultCode[i]);
        }
        emit MissionOpened(id, msg.sender);
    }

    function _live(uint256 id) private view returns (Mission storage m) {
        m = missions[id];
        require(m.operative != address(0), "Unknown mission");
        require(m.outcome == 0, "Mission closed");
    }

    function _current(Mission storage m, uint8 expected) private view returns (Attempt storage a) {
        require(expected == m.attemptsUsed + 1 && expected <= MAX_ATTEMPTS, "Unexpected attempt");
        a = m.attempts[m.attemptsUsed];
    }

    function submitAttempt(uint256 id, uint8 expected, externalEuint8[5] calldata encryptedGuess,
        externalEuint8 encryptedApproach, bytes calldata inputProof) external {
        Mission storage m = _live(id);
        require(msg.sender == m.operative, "Not operative");
        require(block.timestamp <= m.deadlineAt, "Mission expired");
        Attempt storage a = _current(m, expected);
        require(!a.submitted, "Already submitted");
        for (uint8 i = 0; i < CODE_LENGTH; i++) {
            euint8 glyph = FHE.fromExternal(encryptedGuess[i], inputProof);
            a.guess[i] = FHE.select(FHE.lt(glyph, FHE.asEuint8(4)), glyph, FHE.asEuint8(0));
            FHE.allowThis(a.guess[i]);
        }
        euint8 approach = FHE.fromExternal(encryptedApproach, inputProof);
        a.approach = FHE.select(FHE.lt(approach, FHE.asEuint8(3)), approach, FHE.asEuint8(0));
        FHE.allowThis(a.approach);
        a.submitted = true;
        emit AttemptSubmitted(id, expected);
    }

    function resolveAttempt(uint256 id, uint8 expected) external {
        Mission storage m = _live(id);
        require(block.timestamp <= m.recoveryDeadlineAt, "Recovery expired");
        Attempt storage a = _current(m, expected);
        require(a.submitted && !a.resolved && !a.finalized, "Attempt not resolvable");
        euint8 exact = FHE.asEuint8(0);
        for (uint8 i = 0; i < CODE_LENGTH; i++) {
            exact = FHE.add(exact, FHE.select(
                FHE.eq(m.vaultCode[i], a.guess[i]), FHE.asEuint8(1), FHE.asEuint8(0)
            ));
        }
        // Multiset intersection: each occurrence can contribute at most once.
        // Counts and the minimum stay encrypted; loops depend only on public bounds.
        euint8 matched = FHE.asEuint8(0);
        for (uint8 glyph = 0; glyph < 4; glyph++) {
            euint8 symbol = FHE.asEuint8(glyph);
            euint8 secretCount = FHE.asEuint8(0);
            euint8 guessCount = FHE.asEuint8(0);
            for (uint8 i = 0; i < CODE_LENGTH; i++) {
                secretCount = FHE.add(secretCount, FHE.select(
                    FHE.eq(m.vaultCode[i], symbol), FHE.asEuint8(1), FHE.asEuint8(0)
                ));
                guessCount = FHE.add(guessCount, FHE.select(
                    FHE.eq(a.guess[i], symbol), FHE.asEuint8(1), FHE.asEuint8(0)
                ));
            }
            matched = FHE.add(matched, FHE.select(
                FHE.lt(secretCount, guessCount), secretCount, guessCount
            ));
        }
        euint8 misplaced = FHE.sub(matched, exact);
        euint8 probe = FHE.add(FHE.shl(exact, 3), misplaced);
        euint8 breach = FHE.add(FHE.asEuint8(BREACH_BASE), exact);
        a.encryptedFeedback = FHE.select(
            FHE.eq(a.approach, FHE.asEuint8(0)), exact,
            FHE.select(FHE.eq(a.approach, FHE.asEuint8(1)),
                FHE.add(FHE.asEuint8(PROBE_BASE), probe), breach)
        );
        FHE.allowThis(a.encryptedFeedback);
        FHE.makePubliclyDecryptable(a.encryptedFeedback);

        a.resolved = true;
        emit AttemptReady(id, expected, FHE.toBytes32(a.encryptedFeedback));
    }

    function finalizeAttempt(uint256 id, uint8 expected, uint8 packet, bytes calldata proof) external {
        Mission storage m = _live(id);
        require(block.timestamp <= m.recoveryDeadlineAt, "Recovery expired");
        Attempt storage a = _current(m, expected);
        require(a.resolved && !a.finalized, "Attempt not finalizable");
        (uint8 route, uint8 exact) = _decode(packet);
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(a.encryptedFeedback);
        FHE.checkSignatures(handles, abi.encode(packet), proof);
        a.publicFeedback = packet;
        a.finalized = true;
        m.attemptsUsed++;
        m.heat += route;
        if (route == 2 && exact == CODE_LENGTH) {
            uint16 deduction = uint16(m.heat) * 10 + uint16(m.attemptsUsed - 1) * 5;
            m.score = deduction >= 100 ? 0 : uint8(100 - deduction);
            m.outcome = 1;
        } else if (m.attemptsUsed == MAX_ATTEMPTS) {
            m.outcome = 2;
        }
        emit AttemptFinalized(id, expected, packet, m.heat, m.score);
        if (m.outcome != 0) {
            delete activeMission[m.operative];
            emit MissionCompleted(id, m.outcome, m.score, m.heat);
        }
    }

    function _decode(uint8 packet) private pure returns (uint8 route, uint8 exact) {
        if (packet <= 5) return (0, packet);
        if (packet >= PROBE_BASE && packet <= 56) {
            uint8 packed = packet - PROBE_BASE;
            exact = packed >> 3;
            uint8 misplaced = packed & 7;
            require(exact + misplaced <= 5 && !(exact == 4 && misplaced == 1), "Invalid probe feedback");
            return (1, exact);
        }
        if (packet >= BREACH_BASE && packet <= 69) return (2, packet - BREACH_BASE);
        revert("Invalid feedback");
    }

    function expireMission(uint256 id) external {
        Mission storage m = _live(id);
        require(block.timestamp > m.deadlineAt, "Mission still active");
        require(!m.attempts[m.attemptsUsed].submitted, "Attempt still pending");
        m.outcome = 3;
        delete activeMission[m.operative];
        emit MissionExpired(id);
    }

    function abortUnsettled(uint256 id) external {
        Mission storage m = _live(id);
        require(block.timestamp > m.recoveryDeadlineAt, "Recovery still active");
        require(m.attempts[m.attemptsUsed].submitted, "No pending attempt");
        m.outcome = 4;
        delete activeMission[m.operative];
        emit MissionTechnicalAbort(id, m.attemptsUsed + 1);
    }

    function missionStatus(uint256 id) external view returns (address operative, uint64 openedAt,
        uint64 deadlineAt, uint64 recoveryDeadlineAt, uint8 attemptsUsed, uint8 heat, uint8 score, uint8 outcome) {
        Mission storage m = missions[id];
        require(m.operative != address(0), "Unknown mission");
        return (m.operative, m.openedAt, m.deadlineAt, m.recoveryDeadlineAt, m.attemptsUsed, m.heat, m.score, m.outcome);
    }

    function attemptStatus(uint256 id, uint8 attempt) external view returns (bool submitted, bool resolved,
        bool finalized, uint8 publicFeedback) {
        require(missions[id].operative != address(0), "Unknown mission");
        require(attempt >= 1 && attempt <= MAX_ATTEMPTS, "Invalid attempt");
        Attempt storage a = missions[id].attempts[attempt - 1];
        return (a.submitted, a.resolved, a.finalized, a.publicFeedback);
    }

    function feedbackHandle(uint256 id, uint8 attempt) external view returns (bytes32) {
        Mission storage m = _live(id);
        Attempt storage a = _current(m, attempt);
        require(a.resolved && !a.finalized, "Feedback unavailable");
        return FHE.toBytes32(a.encryptedFeedback);
    }
}
