package com.mockinvest.backend.domain.trade;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "trades")
@Getter @Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Trade {
    @Id
    private String id;
    private String loginId;     // 사용자
    private String stockCode;   // 종목 코드
    private String stockName;   // 종목명
    private Integer quantity;   // 현재 보유 수량
    private Long averagePrice;  // 평균 매수 단가 (기존 총 매수금액 + 신규 매수금액) / 전체 수량)

    //매수시 정보 업데이트
    public void updateBuyInfo(int addQty, Long currentPrice) {
        long currentTotalCost = (this.averagePrice * this.quantity) + (currentPrice * addQty);
        this.quantity += addQty;
        this.averagePrice = currentTotalCost / this.quantity;
    }
    //매도시 정보 업데이트
    public void updateSellInfo(int removeQty) {
        if (this.quantity < removeQty) {
            throw new IllegalArgumentException("보유 수량이 부족합니다. (현재: " + this.quantity + ")");
        }
        this.quantity -= removeQty;
    }
}