package com.mockinvest.backend.domain.trade;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * 사용자의 주식 보유 현황을 관리하는 엔티티
 * 특정 종목의 수량과 평균 매수 단가를 저장합니다.
 */
@Document(collection = "trades")
@Getter @Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Trade {
    @Id
    private String id;
    private String loginId;     // 사용자 식별자 (Member.loginId)
    private String stockCode;   // 종목 코드 (예: 005930)
    private String stockName;   // 종목명 (예: 삼성전자)
    private Integer quantity;   // 현재 보유 수량
    private Long averagePrice;  // 평균 매수 단가 (수익률 계산의 기준)

    /**
     * [비즈니스 로직] 매수 시 수량 및 평단가 업데이트
     * 평단가 = (기존 총 매수금액 + 신규 매수금액) / 전체 수량
     */
    public void updateBuyInfo(int addQty, Long currentPrice) {
        long currentTotalCost = (this.averagePrice * this.quantity) + (currentPrice * addQty);
        this.quantity += addQty;
        this.averagePrice = currentTotalCost / this.quantity;
    }

    /**
     * [비즈니스 로직] 매도 시 수량 차감
     */
    public void updateSellInfo(int removeQty) {
        if (this.quantity < removeQty) {
            throw new IllegalArgumentException("보유 수량이 부족합니다. (현재: " + this.quantity + ")");
        }
        this.quantity -= removeQty;
    }
}