package com.mockinvest.backend.domain;

import com.mockinvest.backend.domain.member.Member;
import com.mockinvest.backend.domain.member.MemberRepository;
import com.mockinvest.backend.domain.stock.Stock;
import com.mockinvest.backend.domain.stock.StockRepository;
import com.mockinvest.backend.domain.trade.Trade;
import com.mockinvest.backend.domain.trade.TradeRepository;
import com.mockinvest.backend.domain.trade.TradeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.AssertionsForClassTypes.assertThat;

/**
 * [실시간 DB 가격 조회 검증 테스트]
 * 흉내 내는 가짜 가격이 아니라, 실제 DB(MongoDB)에 저장된 주가를
 * 서비스가 직접 조회하여 거래를 처리하는지 입증합니다.
 */
@SpringBootTest
class TradeServiceIntegrationTest {

    @Autowired
    private TradeService tradeService;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private TradeRepository tradeRepository;

    private final String TEST_ID = "real_db_tester";
    private final String STOCK_CODE = "005930"; // 삼성전자 (크롤러가 이미 DB에 저장해둔 상태여야 함)

    @BeforeEach
    void setUp() {
        // 테스트 전 거래 내역과 회원 정보만 초기화합니다.
        // 주식 정보(Stock)는 크롤러가 가져온 실시간 데이터를 쓰기 위해 지우지 않습니다.
        tradeRepository.deleteAll();
        memberRepository.deleteAll();

        // 테스트 회원 생성 (잔고 1,000만원)
        Member member = Member.builder()
                .loginId(TEST_ID)
                .balance(10000000.0)
                .name("진짜DB테스터")
                .build();
        memberRepository.save(member);
        System.out.println("\n[준비] 테스트용 회원 생성 완료 (잔고: 10,000,000원)");
    }

    @Test
    @DisplayName("DB에 있는 실제 현재가를 가져와서 매수 처리되는지 확인")
    void verifyUsingActualDbPrice() {
        // 1. [검증 전 확인] 먼저 DB에 크롤러가 저장해둔 진짜 가격이 얼마인지 '조회'만 해봅니다.
        // 테스트 코드에서 예상 결과값을 계산하기 위해 미리 확인하는 과정입니다.
        Stock actualStock = stockRepository.findByStockCode(STOCK_CODE)
                .orElseThrow(() -> new RuntimeException("테스트 실패: DB에 '" + STOCK_CODE + "' 주식 데이터가 없습니다. 애플리케이션을 실행하여 크롤러가 데이터를 먼저 쌓게 해주세요."));

        long realDbPrice = actualStock.getCurrentPrice();
        System.out.println("[확인] 현재 MongoDB에 저장되어 있는 삼성전자의 진짜 주가: " + realDbPrice + "원");

        // 2. [서비스 호출] 가격(price) 파라미터 없이 아이디와 수량만 보냅니다.
        // 이 메서드 내부에서 '진짜로' DB를 뒤져서 가격을 가져오는지 테스트합니다.
        int buyQuantity = 10;
        System.out.println(">> 서비스 호출: tradeService.buyStock(" + STOCK_CODE + ", 10주)");
        tradeService.buyStock(TEST_ID, STOCK_CODE, buyQuantity);

        // 3. [결과 검증]
        // 서비스가 DB에서 가져온 진짜 가격(realDbPrice)으로 계산했다면, 잔고는 아래와 같아야 합니다.
        Member updatedMember = memberRepository.findByLoginId(TEST_ID);
        double expectedCost = (double) realDbPrice * buyQuantity;
        double expectedBalance = 10000000.0 - expectedCost;

        System.out.println("[검증] 결과 데이터 확인");
        System.out.println(" - 차감되어야 할 금액 (" + realDbPrice + "원 * " + buyQuantity + "주) = " + expectedCost + "원");
        System.out.println(" - 매수 후 실제 잔고: " + updatedMember.getBalance() + "원");

        // 실제 잔고가 예상 잔고와 일치하는지 확인 (일치하면 서비스가 DB 가격을 정확히 찾아온 것임)
        assertThat(updatedMember.getBalance()).isEqualTo(expectedBalance);

        // Trade 엔티티에도 DB 가격이 평단가로 잘 저장되었는지 확인
        Trade trade = tradeRepository.findByLoginIdAndStockCode(TEST_ID, STOCK_CODE).orElseThrow();
        System.out.println(" - Trade 내역에 기록된 평단가: " + trade.getAveragePrice() + "원");
        assertThat(trade.getAveragePrice()).isEqualTo(realDbPrice);

        System.out.println("\n[결론] 서비스가 하드코딩된 가짜 값이 아니라, DB에 실시간으로 저장되어 있던 " + realDbPrice + "원을 스스로 찾아내어 거래를 완료했습니다.");
    }
}