package com.mockinvest.backend.domain.mission;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * 사용자의 미션 달성 여부(Completed)와 보상 수령 여부(Claimed)를 관리하는 엔티티
 */
@Document(collection = "member_missions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Mission {
    @Id
    private String id;

    private String loginId;    // 사용자 아이디

    // 1. 미션 달성 여부 (시스템이 자동으로 true 변경)
    private boolean buyCompleted;        // 매수
    private boolean sellCompleted;       // 매도
    private boolean quizCompleted;       // 퀴즈
    private boolean likeCompleted;       // 좋아요
    private boolean postCreated;         // 글작성
    private boolean commentCreated;      // 댓글
    private boolean gameCompleted;       // 게임

    // 2. 보상 수령 여부 (사용자가 버튼 클릭 시 true 변경)
    private boolean buyClaimed;
    private boolean sellClaimed;
    private boolean quizClaimed;
    private boolean likeClaimed;
    private boolean postClaimed;
    private boolean commentClaimed;
    private boolean gameClaimed;

    //신규 사용자 초기화
    public static Mission init(String loginId) {
        return Mission.builder()
                .loginId(loginId)
                .build();
    }
}