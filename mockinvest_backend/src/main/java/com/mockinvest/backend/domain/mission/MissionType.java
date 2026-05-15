package com.mockinvest.backend.domain.mission;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 미션의 종류와 각 미션별 보상 금액을 정의하는 Enum
 */
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

    private final String description; // 미션 한글 설명
    private final double rewardAmount; // 미션별 보상 금액
}