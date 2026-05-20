package com.mockinvest.backend.domain.mission;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

//수정: 여러가지 미션과 보상 enum으로 설정
@Getter
@RequiredArgsConstructor
public enum MissionType {
    BUY("주식 매수", 50000.0),
    SELL("주식 매도", 30000.0),
    QUIZ("금융 퀴즈", 20000.0),
    LIKE("좋아요 클릭", 5000.0),
    POST("게시글 작성", 10000.0),
    COMMENT("댓글 작성", 5000.0),
    GAME("미니게임 참여", 15000.0);

    private final String description; // 미션 설명
    private final double rewardAmount; // 미션별 보상 금액
}