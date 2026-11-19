// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SquadGambit — EXPERIMENTAL FHE 3-role confrontation, NOT DEPLOYED
 * Each fighter has independent encrypted (base, trigger, response) orders.
 * One defender squad may be challenged by ONE pre-authorized opponent only.
 * This reduces repeated-query strategy inference but does NOT establish
 * formal secrecy, high entropy, fair matchmaking, or production security.
 *
 * Public result: two aggregate reactor scores (0..5) packed into ONE euint8:
 * packed = scoreA*8 + scoreB. The three private plans and lane outcomes are
 * never publicly decryptable. KMS signed public decryption is verified
 * onchain using the precise stored result handle.
 */
contract SquadGambit is ZamaEthereumConfig {
    struct Squad {
        address owner;
        address opponent;
        bool active;
        bool claimed;
        euint8 formation; // 0 HOLD, 1 PIVOT, 2 FEINT; kept encrypted
        euint8[3] base;
        euint8[3] trigger;
        euint8[3] response;
    }

    struct Duel {
        uint256 squadId;
        address challenger;
        uint64 openedAt;
        bool submitted;
        bool resolved;
        bool finalized;
        bool expired;
        euint8 formation;
        euint8[3] base;
        euint8[3] trigger;
        euint8[3] response;
        euint8 encryptedPackedScore;
        uint8 packedScore;
    }

    uint256 public nextSquadId;
    uint256 public nextDuelId;
    mapping(uint256 => Squad) private squads;
    mapping(uint256 => Duel) private duels;

    event SquadSealed(uint256 indexed squadId, address indexed owner, address indexed allowedOpponent);
    event SquadClosed(uint256 indexed squadId);
    event DuelOpened(uint256 indexed duelId, uint256 indexed squadId, address indexed challenger);
    event DuelSubmitted(uint256 indexed duelId);
    event DuelReady(uint256 indexed duelId, bytes32 resultHandle);
    event DuelFinalized(uint256 indexed duelId, uint8 pointsChallenger, uint8 pointsDefender, uint8 outcome);
    event DuelExpired(uint256 indexed duelId);

    function sealSquad(
        address allowedOpponent,
        externalEuint8[10] calldata encryptedPlans,
        bytes calldata inputProof
    ) external returns (uint256 squadId) {
        require(allowedOpponent != address(0) && allowedOpponent != msg.sender, "Invalid opponent");
        squadId=++nextSquadId;
        Squad storage s=squads[squadId];
        s.owner=msg.sender;
        s.opponent=allowedOpponent;
        s.active=true;
        s.formation=_normalize(FHE.fromExternal(encryptedPlans[9],inputProof));
        FHE.allowThis(s.formation);
        for(uint8 i=0;i<3;i++) {
            s.base[i]=_normalize(FHE.fromExternal(encryptedPlans[uint256(i)*3],inputProof));
            s.trigger[i]=_normalize(FHE.fromExternal(encryptedPlans[uint256(i)*3+1],inputProof));
            s.response[i]=_normalize(FHE.fromExternal(encryptedPlans[uint256(i)*3+2],inputProof));
            FHE.allowThis(s.base[i]);
            FHE.allowThis(s.trigger[i]);
            FHE.allowThis(s.response[i]);
        }
        emit SquadSealed(squadId,msg.sender,allowedOpponent);
    }

    function closeSquad(uint256 squadId) external {
        Squad storage s=squads[squadId];
        require(s.owner==msg.sender,"Not owner");
        require(s.active && !s.claimed,"Unavailable squad");
        s.active=false;
        emit SquadClosed(squadId);
    }

    function openDuel(uint256 squadId) external returns (uint256 duelId) {
        Squad storage s=squads[squadId];
        require(s.active && !s.claimed,"Unavailable squad");
        require(s.owner!=address(0),"Unknown squad");
        require(msg.sender==s.opponent,"Not invited challenger");
        duelId=++nextDuelId;
        s.claimed=true; // One-use only; failure/timeouts do NOT reopen a query oracle
        Duel storage d=duels[duelId];
        d.squadId=squadId;
        d.challenger=msg.sender;
        d.openedAt=uint64(block.timestamp);
        emit DuelOpened(duelId,squadId,msg.sender);
    }

    function submitDuel(
        uint256 duelId,
        externalEuint8[10] calldata encryptedPlans,
        bytes calldata inputProof
    ) external {
        Duel storage d=duels[duelId];
        require(d.challenger==msg.sender,"Not challenger");
        require(!d.submitted && !d.resolved && !d.finalized && !d.expired,"Already submitted");
        require(block.timestamp<=uint256(d.openedAt)+1 days,"Submission expired");
        d.formation=_normalize(FHE.fromExternal(encryptedPlans[9],inputProof));
        FHE.allowThis(d.formation);
        for(uint8 i=0;i<3;i++) {
            d.base[i]=_normalize(FHE.fromExternal(encryptedPlans[uint256(i)*3],inputProof));
            d.trigger[i]=_normalize(FHE.fromExternal(encryptedPlans[uint256(i)*3+1],inputProof));
            d.response[i]=_normalize(FHE.fromExternal(encryptedPlans[uint256(i)*3+2],inputProof));
            FHE.allowThis(d.base[i]);
            FHE.allowThis(d.trigger[i]);
            FHE.allowThis(d.response[i]);
        }
        d.submitted=true;
        emit DuelSubmitted(duelId);
    }

    function resolveDuel(uint256 duelId) external {
        Duel storage d=duels[duelId];
        require(d.submitted && !d.resolved && !d.finalized && !d.expired,"Not resolvable");
        Squad storage defender=squads[d.squadId];

        // Role at visual lane n = (role + formation) mod 3.
        // For challenger role i, opposing defender role is
        // (i + defenderFormation - challengerFormation) mod 3.
        // This encrypted permutation routes BOTH sides without revealing
        // either team's formation on chain.
        ebool same=FHE.eq(d.formation,defender.formation);
        ebool shiftOne=FHE.or(
            FHE.or(
                FHE.and(FHE.eq(d.formation,FHE.asEuint8(0)),FHE.eq(defender.formation,FHE.asEuint8(1))),
                FHE.and(FHE.eq(d.formation,FHE.asEuint8(1)),FHE.eq(defender.formation,FHE.asEuint8(2)))
            ),
            FHE.and(FHE.eq(d.formation,FHE.asEuint8(2)),FHE.eq(defender.formation,FHE.asEuint8(0)))
        );

        // A wins are ordered by challenger role. Temporary B wins here are
        // also ordered by challenger role, then rotated to DEFENDER roles.
        ebool[3] memory challengerWins;
        ebool[3] memory defenderWinsByChallengerRole;
        for(uint8 i=0;i<3;i++){
            (challengerWins[i],defenderWinsByChallengerRole[i])=
                _lane(d,defender,i,same,shiftOne);
        }
        ebool[3] memory defenderWins;
        for(uint8 j=0;j<3;j++) {
            defenderWins[j]=FHE.select(same,defenderWinsByChallengerRole[j],
                FHE.select(shiftOne,defenderWinsByChallengerRole[(j+2)%3],
                    defenderWinsByChallengerRole[(j+1)%3]));
        }
        euint8 pointsA=FHE.asEuint8(0);
        euint8 pointsB=FHE.asEuint8(0);
        for(uint8 i=0;i<3;i++){
            pointsA=FHE.add(pointsA,FHE.select(challengerWins[i],FHE.asEuint8(1),FHE.asEuint8(0)));
            pointsB=FHE.add(pointsB,FHE.select(defenderWins[i],FHE.asEuint8(1),FHE.asEuint8(0)));
        }

        // One extra breach point if Striker wins; Scout mark grants one more
        // when BOTH Scout and Striker win. A winning opposing Guardian
        // blocks one Striker bonus, never the basic lane-win point.
        euint8 extraA=FHE.select(challengerWins[2],FHE.asEuint8(1),FHE.asEuint8(0));
        euint8 extraB=FHE.select(defenderWins[2],FHE.asEuint8(1),FHE.asEuint8(0));
        extraA=FHE.add(extraA,FHE.select(FHE.and(challengerWins[0],challengerWins[2]),FHE.asEuint8(1),FHE.asEuint8(0)));
        extraB=FHE.add(extraB,FHE.select(FHE.and(defenderWins[0],defenderWins[2]),FHE.asEuint8(1),FHE.asEuint8(0)));
        extraA=FHE.sub(extraA,FHE.select(FHE.and(defenderWins[1],challengerWins[2]),FHE.asEuint8(1),FHE.asEuint8(0)));
        extraB=FHE.sub(extraB,FHE.select(FHE.and(challengerWins[1],defenderWins[2]),FHE.asEuint8(1),FHE.asEuint8(0)));
        pointsA=FHE.add(pointsA,extraA);
        pointsB=FHE.add(pointsB,extraB);

        // Pack two 3-bit aggregate scores in one ciphertext, no lane reveal.
        d.encryptedPackedScore=FHE.add(FHE.shl(pointsA,3),pointsB);
        FHE.allowThis(d.encryptedPackedScore);
        FHE.makePubliclyDecryptable(d.encryptedPackedScore);
        d.resolved=true;
        emit DuelReady(duelId,FHE.toBytes32(d.encryptedPackedScore));
    }

    function finalizeDuel(uint256 duelId,uint8 packedScore,bytes calldata proof) external {
        Duel storage d=duels[duelId];
        require(d.resolved && !d.finalized && !d.expired,"Not finalizable");
        uint8 challengerPoints=packedScore>>3;
        uint8 defenderPoints=packedScore & 7;
        require(challengerPoints<=5 && defenderPoints<=5,"Invalid score");
        bytes32[] memory handles=new bytes32[](1);
        handles[0]=FHE.toBytes32(d.encryptedPackedScore);
        FHE.checkSignatures(handles,abi.encode(packedScore),proof);
        d.packedScore=packedScore;
        d.finalized=true;
        uint8 outcome=challengerPoints==defenderPoints?0:challengerPoints>defenderPoints?1:2;
        emit DuelFinalized(duelId,challengerPoints,defenderPoints,outcome);
    }

    function expireUnsubmitted(uint256 duelId) external {
        Duel storage d=duels[duelId];
        require(d.challenger!=address(0),"Unknown duel");
        require(!d.submitted && !d.resolved && !d.finalized && !d.expired,"Already committed");
        require(block.timestamp>uint256(d.openedAt)+1 days,"Still active");
        d.expired=true;
        emit DuelExpired(duelId);
    }

    function squadStatus(uint256 id) external view returns(
        address owner,address allowedOpponent,bool active,bool claimed
    ){
        Squad storage s=squads[id];
        return(s.owner,s.opponent,s.active,s.claimed);
    }

    function duelStatus(uint256 id) external view returns(
        uint256 squadId,address challenger,bool submitted,bool resolved,
        bool finalized,bool expired,uint8 packedScore
    ){
        Duel storage d=duels[id];
        return(d.squadId,d.challenger,d.submitted,d.resolved,d.finalized,d.expired,d.packedScore);
    }

    function publicResultHandle(uint256 duelId) external view returns(bytes32){
        Duel storage d=duels[duelId];
        require(d.resolved && !d.expired,"Result not ready");
        return FHE.toBytes32(d.encryptedPackedScore);
    }

    function _rotate(euint8[3] storage data,uint8 role,ebool same,ebool shiftOne)
        private returns(euint8)
    {
        return FHE.select(same,data[role],FHE.select(shiftOne,
            data[(uint256(role)+1)%3],data[(uint256(role)+2)%3]));
    }

    function _lane(Duel storage d,Squad storage defender,uint8 i,ebool same,ebool shiftOne)
        private returns(ebool,ebool)
    {
        euint8 opponentBase=_rotate(defender.base,i,same,shiftOne);
        euint8 opponentTrigger=_rotate(defender.trigger,i,same,shiftOne);
        euint8 opponentResponse=_rotate(defender.response,i,same,shiftOne);
        euint8 challengerAction=FHE.select(FHE.eq(d.trigger[i],opponentBase),d.response[i],d.base[i]);
        euint8 defenderAction=FHE.select(FHE.eq(opponentTrigger,d.base[i]),opponentResponse,opponentBase);
        ebool draw=FHE.eq(challengerAction,defenderAction);
        ebool challengerWins=FHE.or(
            FHE.or(
                FHE.and(FHE.eq(challengerAction,FHE.asEuint8(0)),FHE.eq(defenderAction,FHE.asEuint8(2))),
                FHE.and(FHE.eq(challengerAction,FHE.asEuint8(1)),FHE.eq(defenderAction,FHE.asEuint8(0)))
            ),
            FHE.and(FHE.eq(challengerAction,FHE.asEuint8(2)),FHE.eq(defenderAction,FHE.asEuint8(1)))
        );
        ebool defenderWins=FHE.and(FHE.not(draw),FHE.not(challengerWins));
        return(challengerWins,defenderWins);
    }

    function _normalize(euint8 value) private returns(euint8){
        return FHE.select(FHE.lt(value,FHE.asEuint8(3)),value,FHE.asEuint8(1));
    }
}
