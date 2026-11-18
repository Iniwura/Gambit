// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title GAMBIT — sealed autonomous defender (research stage).
 * Owner encrypts a permanent hidden conditional combat policy ONCE.
 * Opponents challenge the saved policy without the owner being online.
 * The complete policy is never publicly decrypted; the encounter result is.
 *
 * SECURITY: A repeated-query adversary can infer low-entropy policies from
 * win/loss feedback. This is a proof of architecture, NOT a final secure
 * production game with a high-entropy strategy space or rate limits.
 */
contract SealedGambit is ZamaEthereumConfig {
    struct SealedPolicy {
        address owner;
        bool active;
        euint8 base;
        euint8 trigger;
        euint8 response;
        uint32 completions;
    }
    struct Challenge {
        uint256 policyId;
        address challenger;
        uint64 openedAt;
        bool submitted;
        bool resolved;
        bool finalized;
        bool expired;
        euint8 base;
        euint8 trigger;
        euint8 response;
        euint8 encryptedOutcome;
        uint8 finalOutcome; // 0 draw; 1 challenger; 2 defender
    }

    uint256 public nextPolicyId;
    uint256 public nextChallengeId;
    mapping(uint256 => SealedPolicy) private policies;
    mapping(uint256 => Challenge) private challenges;

    event PolicySealed(uint256 indexed policyId, address indexed owner);
    event PolicyClosed(uint256 indexed policyId);
    event ChallengeOpened(uint256 indexed challengeId, uint256 indexed policyId, address indexed challenger);
    event ChallengerSubmitted(uint256 indexed challengeId, address indexed challenger);
    event ChallengeReady(uint256 indexed challengeId, bytes32 resultHandle);
    event ChallengeFinalized(uint256 indexed challengeId, uint8 outcome);
    event ChallengeExpired(uint256 indexed challengeId);

    function seal(
        externalEuint8 encryptedBase,
        externalEuint8 encryptedTrigger,
        externalEuint8 encryptedResponse,
        bytes calldata proof
    ) external returns (uint256 id) {
        id=++nextPolicyId;
        SealedPolicy storage p=policies[id];
        p.owner=msg.sender;
        p.active=true;
        p.base=_normalize(FHE.fromExternal(encryptedBase,proof));
        p.trigger=_normalize(FHE.fromExternal(encryptedTrigger,proof));
        p.response=_normalize(FHE.fromExternal(encryptedResponse,proof));
        FHE.allowThis(p.base);
        FHE.allowThis(p.trigger);
        FHE.allowThis(p.response);
        // Deliberately NO allow() to third parties and NO public decryption
        // of policy ciphertext. They are stored only for FHE comparisons.
        emit PolicySealed(id,msg.sender);
    }

    function closePolicy(uint256 id) external {
        SealedPolicy storage p=policies[id];
        require(p.owner==msg.sender,"Not owner");
        require(p.active,"Already closed");
        p.active=false;
        emit PolicyClosed(id);
    }

    function openChallenge(uint256 policyId) external returns (uint256 id) {
        SealedPolicy storage p=policies[policyId];
        require(p.owner!=address(0) && p.active,"Unavailable policy");
        require(msg.sender!=p.owner,"Cannot challenge self");
        id=++nextChallengeId;
        Challenge storage c=challenges[id];
        c.policyId=policyId;
        c.challenger=msg.sender;
        c.openedAt=uint64(block.timestamp);
        emit ChallengeOpened(id,policyId,msg.sender);
    }

    function submit(
        uint256 id,
        externalEuint8 encryptedBase,
        externalEuint8 encryptedTrigger,
        externalEuint8 encryptedResponse,
        bytes calldata proof
    ) external {
        Challenge storage c=challenges[id];
        require(c.challenger==msg.sender,"Not challenger");
        require(!c.submitted && !c.resolved && !c.finalized && !c.expired,"Already submitted");
        require(block.timestamp<=uint256(c.openedAt)+1 days,"Expired");
        c.base=_normalize(FHE.fromExternal(encryptedBase,proof));
        c.trigger=_normalize(FHE.fromExternal(encryptedTrigger,proof));
        c.response=_normalize(FHE.fromExternal(encryptedResponse,proof));
        FHE.allowThis(c.base);
        FHE.allowThis(c.trigger);
        FHE.allowThis(c.response);
        c.submitted=true;
        emit ChallengerSubmitted(id,msg.sender);
    }

    function resolve(uint256 id) external {
        Challenge storage c=challenges[id];
        require(c.submitted && !c.resolved && !c.finalized && !c.expired,"Not resolvable");
        SealedPolicy storage d=policies[c.policyId];

        // Each conditional policy reads the other party's ORIGINAL base.
        // This eliminates circular evaluations and order-dependent exploits.
        euint8 challengerAction=FHE.select(FHE.eq(c.trigger,d.base),c.response,c.base);
        euint8 defenderAction=FHE.select(FHE.eq(d.trigger,c.base),d.response,d.base);
        ebool draw=FHE.eq(challengerAction,defenderAction);
        ebool challengerWins=FHE.or(
            FHE.or(
                FHE.and(FHE.eq(challengerAction,FHE.asEuint8(0)),FHE.eq(defenderAction,FHE.asEuint8(2))),
                FHE.and(FHE.eq(challengerAction,FHE.asEuint8(1)),FHE.eq(defenderAction,FHE.asEuint8(0)))
            ),
            FHE.and(FHE.eq(challengerAction,FHE.asEuint8(2)),FHE.eq(defenderAction,FHE.asEuint8(1)))
        );
        c.encryptedOutcome=FHE.select(draw,FHE.asEuint8(0),
            FHE.select(challengerWins,FHE.asEuint8(1),FHE.asEuint8(2)));
        FHE.allowThis(c.encryptedOutcome);
        FHE.makePubliclyDecryptable(c.encryptedOutcome);
        c.resolved=true;
        emit ChallengeReady(id,FHE.toBytes32(c.encryptedOutcome));
    }

    function finalize(uint256 id,uint8 outcome,bytes calldata decryptionProof) external {
        Challenge storage c=challenges[id];
        require(c.resolved && !c.finalized && !c.expired,"Not finalizable");
        require(outcome<=2,"Invalid result");
        bytes32[] memory handles=new bytes32[](1);
        handles[0]=FHE.toBytes32(c.encryptedOutcome);
        FHE.checkSignatures(handles,abi.encode(outcome),decryptionProof);
        c.finalized=true;
        c.finalOutcome=outcome;
        policies[c.policyId].completions++;
        emit ChallengeFinalized(id,outcome);
    }

    function expireUnsubmitted(uint256 id) external {
        Challenge storage c=challenges[id];
        require(c.challenger!=address(0),"Unknown challenge");
        require(!c.submitted && !c.resolved && !c.finalized && !c.expired,"Already committed");
        require(block.timestamp>uint256(c.openedAt)+1 days,"Still active");
        c.expired=true;
        emit ChallengeExpired(id);
    }

    function policyStatus(uint256 id) external view returns(address owner,bool active,uint32 completions) {
        SealedPolicy storage p=policies[id];
        return(p.owner,p.active,p.completions);
    }
    function challengeStatus(uint256 id) external view returns(
        uint256 policyId,address challenger,bool submitted,bool resolved,
        bool finalized,bool expired,uint8 finalOutcome
    ){
        Challenge storage c=challenges[id];
        return(c.policyId,c.challenger,c.submitted,c.resolved,c.finalized,c.expired,c.finalOutcome);
    }
    function _normalize(euint8 value) private returns(euint8) {
        return FHE.select(FHE.lt(value,FHE.asEuint8(3)),value,FHE.asEuint8(1));
    }
}
