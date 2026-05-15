package com.mockinvest.backend.domain.trade;

import com.mockinvest.backend.domain.member.Member;
import com.mockinvest.backend.domain.member.MemberRepository;
import com.mockinvest.backend.domain.mission.MissionService;
import com.mockinvest.backend.domain.mission.MissionType;
import com.mockinvest.backend.domain.stock.Stock;
import com.mockinvest.backend.domain.stock.StockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TradeService {

    private final MemberRepository memberRepository;
    private final StockRepository stockRepository;
    private final TradeRepository tradeRepository;
    private final MissionService missionService;//미션 추가

    /**
     * 주식 매수 (돈 깎고 주식 추가)
     */
    @Transactional
    public void buyStock(String loginId, String stockCode, int quantity) {
        // 1. 데이터 조회
        Stock stock = stockRepository.findByStockCode(stockCode)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 종목입니다."));
        Member member = memberRepository.findByLoginId(loginId);

        long totalPrice = stock.getCurrentPrice() * quantity;

        // 2. 잔고 확인
        if (member.getBalance() < totalPrice) {
            throw new RuntimeException("잔고가 부족합니다. 부족 금액: " + (totalPrice - member.getBalance()));
        }

        // 3. 사용자 잔고 업데이트
        member.setBalance(member.getBalance() - (double)totalPrice);
        memberRepository.save(member);

        // 4. 보유 현황(Trade) 업데이트
        Trade trade = tradeRepository.findByLoginIdAndStockCode(loginId, stockCode)
                .orElse(Trade.builder()
                        .loginId(loginId)
                        .stockCode(stockCode)
                        .stockName(stock.getStockName())
                        .quantity(0)
                        .averagePrice(0L)
                        .build());

        trade.updateBuyInfo(quantity, stock.getCurrentPrice());
        tradeRepository.save(trade);

        missionService.completeMission(loginId, MissionType.BUY);//미션 추가(매수)
    }

    /**
     * 주식 매도 (주식 깎고 돈 추가)
     */
    @Transactional
    public void sellStock(String loginId, String stockCode, int quantity) {
        Stock stock = stockRepository.findByStockCode(stockCode)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 종목입니다."));
        Member member = memberRepository.findByLoginId(loginId);
        Trade trade = tradeRepository.findByLoginIdAndStockCode(loginId, stockCode)
                .orElseThrow(() -> new RuntimeException("해당 주식을 보유하고 있지 않습니다."));

        // 1. 수량 차감
        trade.updateSellInfo(quantity);
        if (trade.getQuantity() == 0) {
            tradeRepository.delete(trade);
        } else {
            tradeRepository.save(trade);
        }

        // 2. 판매 금액 입금 (현재가 기준)
        double sellAmount = (double) stock.getCurrentPrice() * quantity;
        member.setBalance(member.getBalance() + sellAmount);
        memberRepository.save(member);

        missionService.completeMission(loginId,MissionType.SELL);//미션 추가(매도)
    }

    /**
     * 특정 사용자의 보유 주식 리스트 반환
     */
    public List<Trade> getMyTrades(String loginId) {
        return tradeRepository.findByLoginId(loginId);
    }
}