package com.mockinvest.backend.domain.mypage;

import com.mockinvest.backend.domain.member.Member;
import com.mockinvest.backend.domain.member.MemberRepository;
import com.mockinvest.backend.domain.mission.Mission;
import com.mockinvest.backend.domain.mission.MissionRepository;
import com.mockinvest.backend.domain.post.Post;
import com.mockinvest.backend.domain.post.PostRepository; // 필요 시 쿼리 메서드 추가
import com.mockinvest.backend.domain.stock.Stock;
import com.mockinvest.backend.domain.stockgame.history.StockGameMatchHistory1vs1;
import com.mockinvest.backend.domain.stock.StockRepository;
import com.mockinvest.backend.domain.trade.Trade;
import com.mockinvest.backend.domain.trade.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class MyPageService {

    private final MemberRepository memberRepository;
    private final TradeRepository tradeRepository;
    private final StockRepository stockRepository;
    private final MissionRepository missionRepository;
    private final MongoTemplate mongoTemplate; // 유연한 조회를 위해 활용 (또는 PostRepository에 추가)

    public MyPageResponseDto getMyPageData(String loginId) {
        // 1. 유저 정보 조회
        Member member = memberRepository.findByLoginId(loginId);
        if (member == null) throw new IllegalArgumentException("존재하지 않는 회원입니다.");

        // 2. 보유 주식 목록 조회 및 실시간 손익 계산
        List<Trade> trades = tradeRepository.findByLoginId(loginId);
        List<MyPageResponseDto.MyStockDto> myStockDtos = new ArrayList<>();

        long totalStockValue = 0L;  // 총 평가 금액
        long totalInvestment = 0L;  // 총 매수 금액

        for (Trade trade : trades) {
            // 실시간 주가 정보 가져오기
            Stock stock = stockRepository.findByStockCode(trade.getStockCode()).orElse(null);
            long currentPrice = (stock != null) ? stock.getCurrentPrice() : trade.getAveragePrice();

            long purchaseAmount = trade.getAveragePrice() * trade.getQuantity(); // 매수 금액
            long evaluationAmount = currentPrice * trade.getQuantity();         // 평가 금액

            totalInvestment += purchaseAmount;
            totalStockValue += evaluationAmount;

            // 종목별 수익률 계산
            double stockYield = 0.0;
            if (trade.getAveragePrice() > 0) {
                stockYield = ((double) (currentPrice - trade.getAveragePrice()) / trade.getAveragePrice()) * 100.0;
                stockYield = Math.round(stockYield * 100.0) / 100.0; // 소수점 둘째 자리 반올림
            }

            myStockDtos.add(MyPageResponseDto.MyStockDto.builder()
                    .stockCode(trade.getStockCode())
                    .stockName(trade.getStockName())
                    .quantity(trade.getQuantity())
                    .averagePrice(trade.getAveragePrice())
                    .currentPrice(currentPrice)
                    .evaluationValue(evaluationAmount)
                    .yield(stockYield)
                    .build());
        }

        // 전체 투자 수익률 계산
        double totalYield = 0.0;
        if (totalInvestment > 0) {
            totalYield = ((double) (totalStockValue - totalInvestment) / totalInvestment) * 100.0;
            totalYield = Math.round(totalYield * 100.0) / 100.0;
        }

        // 3. 미션 현황 조회 (없으면 초기화 객체 반환)
        Mission mission = missionRepository.findByLoginId(loginId)
                .orElseGet(() -> Mission.init(loginId));

        // 4. 내가 쓴 커뮤니티 글 목록 조회 (author == loginId)
        Query query = new Query(Criteria.where("author").is(loginId));
        List<Post> myPosts = mongoTemplate.find(query, Post.class);

        // 5. 1vs1 매치 히스토리 조회 (players.loginId == loginId)
        Query matchHistoryQuery = new Query(Criteria.where("players.loginId").is(loginId))
                .with(Sort.by(Sort.Direction.DESC, "finishedAt"));
        List<StockGameMatchHistory1vs1> histories = mongoTemplate.find(matchHistoryQuery, StockGameMatchHistory1vs1.class);
        List<MyPageResponseDto.MatchHistoryDto> matchHistoryDtos = histories.stream()
                .map(history -> toMatchHistoryDto(history, loginId))
                .filter(Objects::nonNull)
                .toList();

        // 6. 종합 DTO 조립 및 반환
        return MyPageResponseDto.builder()
                .loginId(member.getLoginId())
                .name(member.getNickname())
                .cashBalance(member.getBalance())
                .totalStockValue(totalStockValue)
                .totalInvestment(totalInvestment)
                .totalYield(totalYield)
                .myStocks(myStockDtos)
                .missionStatus(mission)
                .myPosts(myPosts)
                .matchHistories(matchHistoryDtos)
                .build();
    }

    private MyPageResponseDto.MatchHistoryDto toMatchHistoryDto(StockGameMatchHistory1vs1 history, String loginId) {
        if (history == null || history.getPlayers() == null || history.getPlayers().isEmpty()) {
            return null;
        }

        StockGameMatchHistory1vs1.PlayerRecord me = history.getPlayers().stream()
                .filter(player -> loginId.equals(player.getLoginId()))
                .findFirst()
                .orElse(null);

        if (me == null) {
            return null;
        }

        List<MyPageResponseDto.OpponentDto> opponents = history.getPlayers().stream()
                .filter(player -> !loginId.equals(player.getLoginId()))
                .map(player -> MyPageResponseDto.OpponentDto.builder()
                        .loginId(player.getLoginId())
                        .nickname(player.getNickname())
                        .result(player.getResult())
                        .finalAsset(player.getFinalAsset())
                        .build())
                .toList();

        return MyPageResponseDto.MatchHistoryDto.builder()
                .roomId(history.getRoomId())
                .stockCode(history.getStockCode())
                .stockName(history.getStockName())
                .finishedAt(history.getFinishedAt())
                .myResult(me.getResult())
                .myFinalAsset(me.getFinalAsset())
                .opponents(opponents)
                .build();
    }
}
