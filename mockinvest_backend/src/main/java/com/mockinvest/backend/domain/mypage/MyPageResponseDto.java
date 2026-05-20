package com.mockinvest.backend.domain.mypage;

import com.mockinvest.backend.domain.mission.Mission;
import com.mockinvest.backend.domain.post.Post;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class MyPageResponseDto {
    // 1. 유저 기본 정보 및 자산 현황
    private String loginId;
    private String name;
    private Double cashBalance;       // 보유 현금 (Member.balance)
    private Long totalStockValue;     // 보유 주식 총 평가 금액 (실시간가 * 수량의 합)
    private Long totalInvestment;     // 총 매수 금액 (평단가 * 수량의 합)
    private Double totalYield;        // 총 투자 수익률

    // 2. 상세 내역 리스트
    private List<MyStockDto> myStocks; // 보유 주식 상세 목록 (평단가, 실시간가, 종목별 수익률 포함)
    private Mission missionStatus;     // 미션 진행 현황
    private List<Post> myPosts;        // 내가 작성한 게시글 목록

    @Getter
    @Builder
    public static class MyStockDto {
        private String stockCode;
        private String stockName;
        private Integer quantity;
        private Long averagePrice;   // 평단가
        private Long currentPrice;   // 실시간 현재가
        private Long evaluationValue;// 평가 금액 (현재가 * 수량)
        private Double yield;        // 종목별 수익률
    }
}