// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title BlacksiteMission
 * @notice Isolated FHE mission protocol for the BLACKSITE pillar.
 *
 * The warden's four-glyph vault code, the operative's guesses and the
 * operative's approach are encrypted inputs. The contract never exposes any
 * of those values. Each attempt produces one encrypted feedback packet which
 * is made publicly decryptable only after the attempt is submitted; the KMS
 * proof is then checked onchain before public progress is recorded.
 *
 * Approach tradeoff:
 *   0 STEALTH — exact-position count only; no heat.
 *   1 PROBE   — exact + misplaced counts; +1 heat.
 *   2 BREACH  — exact progress only; +2 heat, but an exact code breaches the
 *               vault and completes the mission.
 *
 * The packet ranges are intentionally disjoint so the authenticated public
 * result can be decoded without storing the hidden approach:
 *   0..4 stealth exact, 16..52 probe packed or breach exact.
 * This is research code and is not deployed or authorized for deployment.
 */
contract BlacksiteMission is ZamaEthereumConfig {
    uint8 public constant CODE_LENGTH = 4;
    uint8 public constant MAX_ATTEMPTS = 5;
    uint64 public constant MISSION_WINDOW = 1 days;
    uint8 private constant PROBE_BASE = 16;
    uint8 private constant BREACH_BASE = 48;

    struct Attempt {
        bool submitted;
        bool resolved;
        bool finalized;
        uint64 submittedAt;
        euint8[4] guess;
        euint8 approach;
        euint8 encryptedFeedback;
        uint8 publicFeedback;
    }

    struct Mission {
        address warden;
        address operative;
        uint64 openedAt;
        uint64 deadlineAt;
        uint8 attemptsUsed;
        uint8 heat;
        uint8 score;
        uint8 outcome; // 0 active, 1 breached, 2 locked, 3 expired
        euint8[4] vaultCode;
        Attempt[5] attempts;
    }

    uint256 public nextMissionId;
    mapping(uint256 => Mission) private missions;

    event MissionOpened(uint256 indexed missionId, address indexed warden, address indexed operative);
    event AttemptSubmitted(uint256 indexed missionId, uint8 indexed attempt);
    event AttemptReady(uint256 indexed missionId, uint8 indexed attempt, bytes32 feedbackHandle);
    event AttemptFinalized(
        uint256 indexed missionId,
        uint8 indexed attempt,
        uint8 publicFeedback,
        uint8 heat,
        uint8 score
    );
    event MissionCompleted(uint256 indexed missionId, uint8 outcome, uint8 score, uint8 heat);
    event MissionExpired(uint256 indexed missionId);

    function openMission(
        address operative,
        externalEuint8[4] calldata encryptedVaultCode,
        bytes calldata inputProof
    ) external returns (uint256 missionId) {
        require(operative != address(0) && operative != msg.sender, "Invalid operative");
        missionId = ++nextMissionId;
        Mission storage m = missions[missionId];
        m.warden = msg.sender;
        m.operative = operative;
        m.openedAt = uint64(block.timestamp);
        m.deadlineAt = uint64(block.timestamp + MISSION_WINDOW);
        for (uint8 i = 0; i < CODE_LENGTH; i++) {
            m.vaultCode[i] = _normalizeGlyph(FHE.fromExternal(encryptedVaultCode[i], inputProof));
            FHE.allowThis(m.vaultCode[i]);
        }
        emit MissionOpened(missionId, msg.sender, operative);
    }

    function submitAttempt(
        uint256 missionId,
        uint8 expectedAttempt,
        externalEuint8[4] calldata encryptedGuess,
        externalEuint8 encryptedApproach,
        bytes calldata inputProof
    ) external {
        Mission storage m = missions[missionId];
        require(m.warden != address(0), "Unknown mission");
        require(msg.sender == m.operative, "Not operative");
        require(m.outcome == 0, "Mission closed");
        require(block.timestamp <= m.deadlineAt, "Mission expired");
        require(expectedAttempt == m.attemptsUsed + 1 && expectedAttempt <= MAX_ATTEMPTS,
            "Unexpected attempt");
        Attempt storage a = m.attempts[m.attemptsUsed];
        require(!a.submitted, "Already submitted");

        for (uint8 i = 0; i < CODE_LENGTH; i++) {
            a.guess[i] = _normalizeGlyph(FHE.fromExternal(encryptedGuess[i], inputProof));
            FHE.allowThis(a.guess[i]);
        }
        a.approach = _normalizeApproach(FHE.fromExternal(encryptedApproach, inputProof));
        FHE.allowThis(a.approach);
        a.submitted = true;
        a.submittedAt = uint64(block.timestamp);
        emit AttemptSubmitted(missionId, expectedAttempt);
    }

    function resolveAttempt(uint256 missionId, uint8 expectedAttempt) external {
        Mission storage m = missions[missionId];
        require(m.warden != address(0), "Unknown mission");
        require(m.outcome == 0, "Mission closed");
        require(expectedAttempt == m.attemptsUsed + 1 && expectedAttempt <= MAX_ATTEMPTS,
            "Unexpected attempt");
        Attempt storage a = m.attempts[m.attemptsUsed];
        require(a.submitted && !a.resolved && !a.finalized, "Attempt not resolvable");

        euint8 exact = FHE.asEuint8(0);
        euint8 matched = FHE.asEuint8(0);
        for (uint8 i = 0; i < CODE_LENGTH; i++) {
            exact = FHE.add(exact, FHE.select(
                FHE.eq(m.vaultCode[i], a.guess[i]), FHE.asEuint8(1), FHE.asEuint8(0)
            ));
            ebool found = FHE.eq(m.vaultCode[i], a.guess[0]);
            for (uint8 j = 1; j < CODE_LENGTH; j++) {
                found = FHE.or(found, FHE.eq(m.vaultCode[i], a.guess[j]));
            }
            matched = FHE.add(matched, FHE.select(
                found, FHE.asEuint8(1), FHE.asEuint8(0)
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
        emit AttemptReady(missionId, expectedAttempt, FHE.toBytes32(a.encryptedFeedback));
    }

    function finalizeAttempt(
        uint256 missionId,
        uint8 expectedAttempt,
        uint8 publicFeedback,
        bytes calldata decryptionProof
    ) external {
        Mission storage m = missions[missionId];
        require(m.warden != address(0), "Unknown mission");
        require(m.outcome == 0, "Mission closed");
        require(expectedAttempt == m.attemptsUsed + 1 && expectedAttempt <= MAX_ATTEMPTS,
            "Unexpected attempt");
        Attempt storage a = m.attempts[m.attemptsUsed];
        require(a.resolved && !a.finalized, "Attempt not finalizable");

        uint8 exact;
        uint8 misplaced;
        uint8 approach;
        if (publicFeedback <= 4) {
            exact = publicFeedback;
            approach = 0;
        } else if (publicFeedback >= PROBE_BASE && publicFeedback < BREACH_BASE) {
            uint8 packed = publicFeedback - PROBE_BASE;
            exact = packed >> 3;
            misplaced = packed & 7;
            require(exact <= 4 && misplaced <= 4 && exact + misplaced <= 4,
                "Invalid probe feedback");
            approach = 1;
        } else if (publicFeedback >= BREACH_BASE && publicFeedback <= BREACH_BASE + 4) {
            exact = publicFeedback - BREACH_BASE;
            approach = 2;
        } else {
            revert("Invalid feedback");
        }
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(a.encryptedFeedback);
        FHE.checkSignatures(handles, abi.encode(publicFeedback), decryptionProof);

        a.publicFeedback = publicFeedback;
        a.finalized = true;
        m.attemptsUsed += 1;
        if (approach == 1) m.heat += 1;
        if (approach == 2) m.heat += 2;
        if (approach == 2 && exact == CODE_LENGTH) {
            uint16 deduction = uint16(m.heat) * 10 + uint16(m.attemptsUsed - 1) * 5;
            m.score = deduction >= 100 ? 0 : uint8(100 - deduction);
            m.outcome = 1;
        } else if (m.attemptsUsed == MAX_ATTEMPTS) {
            m.outcome = 2;
            m.score = 0;
        }
        emit AttemptFinalized(missionId, expectedAttempt, publicFeedback, m.heat, m.score);
        if (m.outcome != 0) emit MissionCompleted(missionId, m.outcome, m.score, m.heat);
    }

    function expireMission(uint256 missionId) external {
        Mission storage m = missions[missionId];
        require(m.warden != address(0), "Unknown mission");
        require(m.outcome == 0, "Mission closed");
        require(block.timestamp > m.deadlineAt, "Mission still active");
        Attempt storage a = m.attempts[m.attemptsUsed];
        require(!a.submitted || a.finalized, "Attempt still pending");
        m.outcome = 3;
        emit MissionExpired(missionId);
    }

    function missionStatus(uint256 missionId) external view returns (
        address warden,
        address operative,
        uint64 openedAt,
        uint64 deadlineAt,
        uint8 attemptsUsed,
        uint8 heat,
        uint8 score,
        uint8 outcome
    ) {
        Mission storage m = missions[missionId];
        return (m.warden, m.operative, m.openedAt, m.deadlineAt,
            m.attemptsUsed, m.heat, m.score, m.outcome);
    }

    function attemptStatus(uint256 missionId, uint8 attempt) external view returns (
        bool submitted,
        bool resolved,
        bool finalized,
        uint8 publicFeedback
    ) {
        require(attempt >= 1 && attempt <= MAX_ATTEMPTS, "Invalid attempt");
        Attempt storage a = missions[missionId].attempts[attempt - 1];
        return (a.submitted, a.resolved, a.finalized, a.publicFeedback);
    }

    function feedbackHandle(uint256 missionId, uint8 attempt) external view returns (bytes32) {
        require(attempt >= 1 && attempt <= MAX_ATTEMPTS, "Invalid attempt");
        Attempt storage a = missions[missionId].attempts[attempt - 1];
        require(a.resolved && !a.finalized, "Feedback unavailable");
        return FHE.toBytes32(a.encryptedFeedback);
    }

    function _normalizeGlyph(euint8 value) private returns (euint8) {
        return FHE.select(FHE.lt(value, FHE.asEuint8(4)), value, FHE.asEuint8(0));
    }

    function _normalizeApproach(euint8 value) private returns (euint8) {
        return FHE.select(FHE.lt(value, FHE.asEuint8(3)), value, FHE.asEuint8(0));
    }
}
