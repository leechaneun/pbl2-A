package com.mockinvest.backend.domain.mission;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.mockinvest.backend.domain.member.Member;
import com.mockinvest.backend.domain.member.MemberRepository;
import org.springframework.transaction.annotation.Transactional;


@Service
@RequiredArgsConstructor
public class MissionService {

    private final MissionRepository missionRepository;
    private final MemberRepository memberRepository;

    public Mission getMissionStatus(String loginId) {
        return missionRepository.findByLoginId(loginId)
                .orElseGet(() -> missionRepository.save(Mission.init(loginId)));
    }

   //미션 달성 여부
    public void completeMission(String loginId, MissionType type) {
        Mission mission = getMissionStatus(loginId);

        switch (type) {
            case BUY -> mission.setBuyCompleted(true);
            case SELL -> mission.setSellCompleted(true);
            case QUIZ -> mission.setQuizCompleted(true);
            case LIKE -> mission.setLikeCompleted(true);
            case POST -> mission.setPostCreated(true);
            case COMMENT -> mission.setCommentCreated(true);
            case GAME -> mission.setGameCompleted(true);
        }

        missionRepository.save(mission);
    }

    //이상 없을 시 보상 지급
    @Transactional
    public void claimReward(String loginId, MissionType type) {
        Mission mission = getMissionStatus(loginId);
        Member member = memberRepository.findByLoginId(loginId);

        if (member == null) throw new RuntimeException("사용자를 찾을 수 없습니다.");

        if (!canClaim(mission, type)) {
            throw new RuntimeException("미션을 달성하지 않았거나 이미 보상을 받았습니다.");
        }

        double rewardAmount = type.getRewardAmount();
        member.setBalance(member.getBalance() + rewardAmount);
        memberRepository.save(member);

        updateClaimStatus(mission, type);
        missionRepository.save(mission);
    }

    //보상 줄지 말지 판단
    private boolean canClaim(Mission m, MissionType type) {
        return switch (type) {
            case BUY -> m.isBuyCompleted() && !m.isBuyClaimed();
            case SELL -> m.isSellCompleted() && !m.isSellClaimed();
            case QUIZ -> m.isQuizCompleted() && !m.isQuizClaimed();
            case LIKE -> m.isLikeCompleted() && !m.isLikeClaimed();
            case POST -> m.isPostCreated() && !m.isPostClaimed();
            case COMMENT -> m.isCommentCreated() && !m.isCommentClaimed();
            case GAME -> m.isGameCompleted() && !m.isGameClaimed();
        };
    }

    //미션 상태 업데이트
    private void updateClaimStatus(Mission m, MissionType type) {
        switch (type) {
            case BUY -> m.setBuyClaimed(true);
            case SELL -> m.setSellClaimed(true);
            case QUIZ -> m.setQuizClaimed(true);
            case LIKE -> m.setLikeClaimed(true);
            case POST -> m.setPostClaimed(true);
            case COMMENT -> m.setCommentClaimed(true);
            case GAME -> m.setGameClaimed(true);
        }
    }
}