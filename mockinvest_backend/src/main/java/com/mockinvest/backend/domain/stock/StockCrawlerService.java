package com.mockinvest.backend.domain.stock;


import lombok.RequiredArgsConstructor;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;



//크롤링 방법 https://jul-liet.tistory.com/209 참고


@Slf4j
@Service
@RequiredArgsConstructor
public class StockCrawlerService {

    private final StockRepository stockRepository;

    // 사용자님의 40개 주요 종목 코드 리스트 (유지)
    private final List<String> codes = Arrays.asList(
            "005930", "000660", "066570", "005490", "035420",
            "035720", "323410", "181710", "373220", "006400",
            "086520", "247540", "003670", "005380", "000270",
            "012330", "105560", "055550", "086790", "316140",
            "207940", "068270", "000100", "128940", "352820",
            "035900", "041510", "259960", "036570", "263750",
            "139480", "090430", "004370", "034020", "064350",
            "066970", "112040", "000990", "058470", "003490"
    );

    @Scheduled(fixedRate = 30000) // 30초마다 실행
    public void refreshMarketPrices() {
        log.info("========== 실시간 주가 데이터 동기화 시작 (40개 종목) ==========");

        for (String code : codes) {
            String URL = "https://finance.naver.com/item/main.naver?code=" + code;

            try {
                Document doc = Jsoup.connect(URL)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36")
                        .get();

                Elements todaylist = doc.select(".new_totalinfo dl>dd");

                if (todaylist.size() > 3) {
                    // [사용자 제공 코드 기반] 인덱스 파싱
                    String name = todaylist.get(1).text().split(" ")[1];
                    String priceLine = todaylist.get(3).text();
                    String[] parts = priceLine.split(" ");

                    // 사용자님이 "된다"고 하신 인덱스 유지
                    String juga = parts[1]; // 현재가
                    String rate = (parts.length > 6) ? parts[6] : parts[parts.length - 1]; // 등락률

                    // [추가] 하락 판별: 텍스트 전체(priceLine)나 등락률(rate)에 하락 신호가 있는지 확인
                    boolean isDown = priceLine.contains("하락") || priceLine.contains("▼") || rate.contains("-");

                    updateStockPrice(code, name, juga, rate, isDown);
                }

                Thread.sleep(150); // 서버 부하 방지

            } catch (IOException | InterruptedException e) {
                log.error("크롤링 에러 [코드: {}]: {}", code, e.getMessage());
            } catch (Exception e) {
                log.error("파싱 오류 [코드: {}]: {}", code, e.getMessage());
            }
        }

        log.info("========== 실시간 주가 데이터 동기화 완료 ==========");
    }

    private void updateStockPrice(String code, String name, String juga, String rate, boolean isDown) {
        Stock stock = stockRepository.findByStockCode(code)
                .orElseGet(() -> {
                    log.info("신규 종목 데이터 생성: {} ({})", name, code);
                    return Stock.builder()
                            .stockCode(code)
                            .stockName(name)
                            .currentPrice(0L)
                            .changeRate(0.0)
                            .build();
                });

        try {
            // 가격 데이터 정제 (숫자 외 제거)
            String cleanJuga = juga.replaceAll("[^0-9]", "");
            Long currentPrice = cleanJuga.isEmpty() ? 0L : Long.parseLong(cleanJuga);

            // 등락률 데이터 정제 (숫자와 소수점만 추출)
            String rateValue = rate.replaceAll("[^0-9.]", "");
            if (rateValue.isEmpty() || rateValue.equals(".")) {
                rateValue = "0.0";
            }
            Double changeRate = Double.parseDouble(rateValue);

            // [핵심] 하락 판별 결과에 따라 부호 부여
            if (isDown) {
                changeRate = -Math.abs(changeRate);
            } else if (rate.contains("0.00")) {
                changeRate = 0.0;
            }

            stock.setStockName(name);
            stock.setCurrentPrice(currentPrice);
            stock.setChangeRate(changeRate);
            stock.setLastUpdated(LocalDateTime.now());

            stockRepository.save(stock);
            log.debug("동기화 성공: {} ({}%)", name, changeRate);

        } catch (Exception e) {
            log.error("데이터 변환 실패 [종목: {}]: {}", name, e.getMessage());
        }
    }
}