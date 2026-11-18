// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// RESEARCH CONTRACT: code is NOT COMPILED and NOT DEPLOYED.
// Uses Zama FHEVM documented operations; requires official Hardhat plugin and
// integration tests before any testnet deployment. Do NOT claim functional FHE.
import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/** @notice A single encrypted confrontation; no fake onchain 3v3 simulation.
 *  The two base plans are secret, and contingent responses depend on the OTHER
 *  player's encrypted base plan. Both derived actions resolve simultaneously.
 *  Only outcome 0=draw / 1=A / 2=B becomes publicly decryptable.
 */
contract EncryptedGambit is ZamaEthereumConfig {
    struct PrivatePlan {
        euint8 base;        // 0 STRIKE, 1 GUARD, 2 FLANK
        euint8 trigger;     // opponent base action to respond to
        euint8 response;    // override if opponent base equals trigger
    }
    struct Confrontation {
        address challenger;
        address opponent;
        uint64 openedAt;
        bool challengerCommitted;
        bool opponentCommitted;
        bool resolved;
        bool finalized;
        bool expired;
        PrivatePlan challengerPlan;
        PrivatePlan opponentPlan;
        euint8 encryptedOutcome;
        uint8 publicOutcome;
    }
    uint256 public nextConfrontationId;
    mapping(uint256 => Confrontation) private confrontations;

    event ConfrontationOpened(uint256 indexed id, address indexed challenger, address indexed opponent);
    event PlanCommitted(uint256 indexed id, address indexed player);
    event OutcomeReady(uint256 indexed id, bytes32 encryptedOutcomeHandle);
    event OutcomeFinalized(uint256 indexed id, uint8 result);
    event ConfrontationExpired(uint256 indexed id);

    function open(address opponent) external returns (uint256 id) {
        require(opponent != address(0) && opponent != msg.sender, "Invalid opponent");
        id = ++nextConfrontationId;
        Confrontation storage c = confrontations[id];
        c.challenger = msg.sender;
        c.opponent = opponent;
        c.openedAt = uint64(block.timestamp);
        emit ConfrontationOpened(id, msg.sender, opponent);
    }

    function commitPlan(
        uint256 id,
        externalEuint8 encryptedBase,
        externalEuint8 encryptedTrigger,
        externalEuint8 encryptedResponse,
        bytes calldata proof
    ) external {
        Confrontation storage c = confrontations[id];
        require(!c.expired && !c.resolved && !c.finalized, "Closed");
        require(block.timestamp <= uint256(c.openedAt) + 1 days, "Expired");
        bool challenger = msg.sender == c.challenger;
        require(challenger || msg.sender == c.opponent, "Not a participant");
        require(challenger ? !c.challengerCommitted : !c.opponentCommitted, "Already committed");

        PrivatePlan storage p = challenger ? c.challengerPlan : c.opponentPlan;
        p.base = _normalize(FHE.fromExternal(encryptedBase, proof));
        p.trigger = _normalize(FHE.fromExternal(encryptedTrigger, proof));
        p.response = _normalize(FHE.fromExternal(encryptedResponse, proof));
        FHE.allowThis(p.base);
        FHE.allowThis(p.trigger);
        FHE.allowThis(p.response);
        if (challenger) c.challengerCommitted = true;
        else c.opponentCommitted = true;
        emit PlanCommitted(id, msg.sender);
    }

    function resolve(uint256 id) external {
        Confrontation storage c = confrontations[id];
        require(!c.expired && !c.resolved && !c.finalized, "Closed");
        require(c.challengerCommitted && c.opponentCommitted, "Missing plan");
        PrivatePlan storage a = c.challengerPlan;
        PrivatePlan storage b = c.opponentPlan;

        // Both rules inspect the ORIGINAL opposing base, avoiding
        // circular dependency / ambiguous infinite counter-selection.
        euint8 actualA = FHE.select(FHE.eq(a.trigger, b.base), a.response, a.base);
        euint8 actualB = FHE.select(FHE.eq(b.trigger, a.base), b.response, b.base);
        ebool draw = FHE.eq(actualA, actualB);
        ebool aWins = FHE.or(
            FHE.or(
                FHE.and(FHE.eq(actualA, FHE.asEuint8(0)), FHE.eq(actualB, FHE.asEuint8(2))),
                FHE.and(FHE.eq(actualA, FHE.asEuint8(1)), FHE.eq(actualB, FHE.asEuint8(0)))
            ),
            FHE.and(FHE.eq(actualA, FHE.asEuint8(2)), FHE.eq(actualB, FHE.asEuint8(1)))
        );
        c.encryptedOutcome = FHE.select(draw, FHE.asEuint8(0),
            FHE.select(aWins, FHE.asEuint8(1), FHE.asEuint8(2)));
        FHE.allowThis(c.encryptedOutcome);
        FHE.makePubliclyDecryptable(c.encryptedOutcome);
        c.resolved = true;
        emit OutcomeReady(id, FHE.toBytes32(c.encryptedOutcome));
    }

    function finalize(uint256 id, uint8 outcome, bytes calldata decryptionProof) external {
        Confrontation storage c = confrontations[id];
        require(c.resolved && !c.finalized && !c.expired, "Not resolvable");
        require(outcome <= 2, "Invalid outcome");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(c.encryptedOutcome);
        FHE.checkSignatures(handles, abi.encode(outcome), decryptionProof);
        c.finalized = true;
        c.publicOutcome = outcome;
        emit OutcomeFinalized(id, outcome);
    }

    function expireUncommitted(uint256 id) external {
        Confrontation storage c = confrontations[id];
        require(c.challenger != address(0), "Unknown match");
        require(!c.expired && !c.resolved && !c.finalized, "Closed");
        require(!(c.challengerCommitted && c.opponentCommitted), "Both committed");
        require(block.timestamp > uint256(c.openedAt) + 1 days, "Still active");
        c.expired = true;
        emit ConfrontationExpired(id);
    }

    function status(uint256 id) external view returns (
        address challenger, address opponent, bool aCommitted, bool bCommitted,
        bool resolved, bool finalized, bool expired, uint8 publicOutcome
    ) {
        Confrontation storage c = confrontations[id];
        return (c.challenger, c.opponent, c.challengerCommitted, c.opponentCommitted,
            c.resolved, c.finalized, c.expired, c.publicOutcome);
    }

    function _normalize(euint8 inputValue) private returns (euint8) {
        // Invalid encrypted values are mapped to GUARD without revealing the
        // validity bit. Revisit with ZK range proofs before release.
        return FHE.select(FHE.lt(inputValue, FHE.asEuint8(3)), inputValue, FHE.asEuint8(1));
    }
}
