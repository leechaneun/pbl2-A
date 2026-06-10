package com.mockinvest.backend.domain.stockgame.history;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockGameHistoryService {

    private static final DateTimeFormatter NAVER_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy.MM.dd");
    private static final int MAX_NAVER_PAGE = 120;
    private static final String NAVER_DAY_PRICE_URL = "https://finance.naver.com/item/sise_day.naver?code=%s&page=%d";

    private final StockGameHistoryRepository stockGameHistoryRepository;
    private final ObjectMapper objectMapper;
    private final Map<String, String> stockNameOverrides = new HashMap<>();

    private final List<String> stockCodes = Arrays.asList(
            "005930", "000660", "066570", "005490", "035420",
            "035720", "323410", "181710", "373220", "006400",
            "086520", "247540", "003670", "005380", "000270",
            "012330", "105560", "055550", "086790", "316140",
            "207940", "068270", "000100", "128940", "352820",
            "035900", "041510", "259960", "036570", "263750",
            "139480", "090430", "004370", "034020", "064350",
            "066970", "112040", "000990", "058470", "003490"
    );

    public List<String> getSupportedStockCodes() {
        return stockCodes;
    }

    @PostConstruct
    void loadStockNameOverrides() {
        List<Path> candidates = List.of(
                Paths.get("..", "mocktrade.stocks.json"),
                Paths.get("mocktrade.stocks.json")
        );

        for (Path path : candidates) {
            if (!Files.exists(path)) {
                continue;
            }
            try {
                JsonNode root = objectMapper.readTree(path.toFile());
                if (!root.isArray()) {
                    continue;
                }
                for (JsonNode node : root) {
                    String code = node.path("stockCode").asText("").trim();
                    String name = node.path("stockName").asText("").trim();
                    if (!code.isBlank() && !name.isBlank() && !code.equals(name)) {
                        stockNameOverrides.put(code, name);
                    }
                }
                log.info("stock name override loaded. path={}, size={}", path.toAbsolutePath(), stockNameOverrides.size());
                return;
            } catch (Exception e) {
                log.warn("failed to load stock name override file. path={}, reason={}", path.toAbsolutePath(), e.getMessage());
            }
        }

        log.warn("stock name override file not found. tried paths: ../mocktrade.stocks.json, ./mocktrade.stocks.json");
    }

    public int syncThreeYearsForAllStocks() {
        int saved = 0;
        for (String stockCode : stockCodes) {
            saved += syncStockHistory(stockCode, LocalDate.now().minusYears(3), LocalDate.now());
        }
        return saved;
    }

    public int syncStockHistory(String stockCode, LocalDate from, LocalDate to) {
        validateRange(from, to);
        List<StockGameHistory> crawled = crawlDailyPrices(stockCode, from, to);

        int saved = 0;
        for (StockGameHistory item : crawled) {
            StockGameHistory target = stockGameHistoryRepository
                    .findByStockCodeAndTradeDate(stockCode, item.getTradeDate())
                    .orElseGet(StockGameHistory::new);

            target.setStockCode(stockCode);
            target.setStockName(resolveStockName(stockCode, item.getStockName()));
            target.setTradeDate(item.getTradeDate());
            target.setOpenPrice(item.getOpenPrice());
            target.setHighPrice(item.getHighPrice());
            target.setLowPrice(item.getLowPrice());
            target.setClosePrice(item.getClosePrice());
            target.setVolume(item.getVolume());

            stockGameHistoryRepository.save(target);
            saved += 1;
        }

        return saved;
    }

    public List<StockGameHistory> getStockHistory(String stockCode, LocalDate from, LocalDate to) {
        validateRange(from, to);
        return stockGameHistoryRepository.findByStockCodeAndTradeDateBetweenOrderByTradeDateAsc(stockCode, from, to);
    }

    public GameChartScenario getRandomSixMonthScenario(List<String> preferredCodes) {
        List<String> candidateCodes = (preferredCodes == null || preferredCodes.isEmpty()) ? stockCodes : preferredCodes;
        if (candidateCodes.isEmpty()) {
            throw new IllegalStateException("시나리오 생성 대상 종목 코드가 없습니다.");
        }

        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<String> shuffledCodes = new ArrayList<>(candidateCodes);
        Collections.shuffle(shuffledCodes);

        for (String selectedCode : shuffledCodes) {
            int lookbackYears = random.nextInt(1, 4);

            LocalDate baseAnchor = LocalDate.now().minusYears(lookbackYears);
            LocalDate randomStart = baseAnchor.minusMonths(3 + random.nextInt(0, 7));
            LocalDate randomEnd = randomStart.plusMonths(6);

            List<StockGameHistory> rows = stockGameHistoryRepository
                    .findByStockCodeAndTradeDateBetweenOrderByTradeDateAsc(selectedCode, randomStart, randomEnd);

            if (rows.size() < 60) {
                LocalDate fallbackFrom = LocalDate.now().minusYears(3);
                LocalDate fallbackTo = LocalDate.now().minusYears(1);
                rows = stockGameHistoryRepository.findByStockCodeAndTradeDateBetweenOrderByTradeDateAsc(
                        selectedCode,
                        fallbackFrom,
                        fallbackTo
                );
            }

            if (rows.size() < 60) {
                continue;
            }

            int maxStartIndex = Math.max(0, rows.size() - 120);
            int startIndex = random.nextInt(maxStartIndex + 1);
            int endIndex = Math.min(rows.size(), startIndex + 120);
            List<StockGameHistory> window = rows.subList(startIndex, endIndex);

            List<Long> openPrices = window.stream().map(StockGameHistory::getOpenPrice).toList();
            List<Long> highPrices = window.stream().map(StockGameHistory::getHighPrice).toList();
            List<Long> lowPrices = window.stream().map(StockGameHistory::getLowPrice).toList();
            List<Long> closePrices = window.stream().map(StockGameHistory::getClosePrice).toList();
            List<Long> volumes = window.stream().map(StockGameHistory::getVolume).toList();
            String stockName = resolveStockName(selectedCode, window.get(0).getStockName());
            LocalDate fromDate = window.get(0).getTradeDate();
            LocalDate toDate = window.get(window.size() - 1).getTradeDate();

            return new GameChartScenario(
                    selectedCode,
                    stockName,
                    lookbackYears,
                    fromDate.toString(),
                    toDate.toString(),
                    openPrices,
                    highPrices,
                    lowPrices,
                    closePrices,
                    volumes
            );
        }

        throw new IllegalStateException("게임용 과거 데이터가 충분한 종목을 찾지 못했습니다. history/sync를 먼저 실행해 주세요.");
    }

    private List<StockGameHistory> crawlDailyPrices(String stockCode, LocalDate from, LocalDate to) {
        List<StockGameHistory> results = new ArrayList<>();
        String stockName = null;

        for (int page = 1; page <= MAX_NAVER_PAGE; page += 1) {
            String url = NAVER_DAY_PRICE_URL.formatted(stockCode, page);
            Document document;

            try {
                document = Jsoup.connect(url)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                        .get();
            } catch (IOException e) {
                log.warn("stock game history crawl failed. stockCode={}, page={}, reason={}", stockCode, page, e.getMessage());
                break;
            }

            if (stockName == null) {
                stockName = resolveStockName(stockCode, extractStockName(document, stockCode));
            }

            Elements rows = document.select("table.type2 tr");
            boolean hasValidRow = false;
            boolean reachedOlderThanFrom = false;

            for (Element row : rows) {
                Elements columns = row.select("td");
                if (columns.size() < 7) {
                    continue;
                }

                String dateText = columns.get(0).text().trim();
                if (dateText.isBlank() || !dateText.contains(".")) {
                    continue;
                }

                LocalDate tradeDate;
                try {
                    tradeDate = LocalDate.parse(dateText, NAVER_DATE_FORMATTER);
                } catch (Exception ignored) {
                    continue;
                }

                hasValidRow = true;

                if (tradeDate.isBefore(from)) {
                    reachedOlderThanFrom = true;
                    continue;
                }
                if (tradeDate.isAfter(to)) {
                    continue;
                }

                Long closePrice = parseKoreanNumber(columns.get(1).text());
                Long openPrice = parseKoreanNumber(columns.get(3).text());
                Long highPrice = parseKoreanNumber(columns.get(4).text());
                Long lowPrice = parseKoreanNumber(columns.get(5).text());
                Long volume = parseKoreanNumber(columns.get(6).text());

                if (closePrice == null || openPrice == null || highPrice == null || lowPrice == null || volume == null) {
                    continue;
                }

                results.add(StockGameHistory.builder()
                        .stockCode(stockCode)
                        .stockName(stockName)
                        .tradeDate(tradeDate)
                        .openPrice(openPrice)
                        .highPrice(highPrice)
                        .lowPrice(lowPrice)
                        .closePrice(closePrice)
                        .volume(volume)
                        .build());
            }

            if (!hasValidRow || reachedOlderThanFrom) {
                break;
            }
        }

        return results.stream()
                .sorted(Comparator.comparing(StockGameHistory::getTradeDate))
                .toList();
    }

    private String extractStockName(Document document, String stockCode) {
        if (document == null) {
            return stockCode;
        }

        Element companyTitle = document.selectFirst("div.wrap_company h2 a");
        if (companyTitle != null) {
            String parsed = companyTitle.text().trim();
            if (!parsed.isBlank() && !parsed.equals(stockCode)) {
                return parsed;
            }
        }

        String pageTitle = document.title();
        if (pageTitle != null && !pageTitle.isBlank()) {
            // Example: "삼성전자 : 네이버페이 증권"
            String parsed = pageTitle.split(":")[0].trim();
            if (!parsed.isBlank() && !parsed.equals(stockCode)) {
                return parsed;
            }
        }

        return stockCode;
    }

    private String resolveStockName(String stockCode, String parsedName) {
        String overrideName = stockNameOverrides.get(stockCode);
        if (overrideName != null && !overrideName.isBlank()) {
            return overrideName;
        }

        String safeParsed = parsedName == null ? "" : parsedName.trim();
        if (!safeParsed.isBlank() && !safeParsed.equals(stockCode)) {
            return safeParsed;
        }
        return stockCode;
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("from/to 날짜가 필요합니다.");
        }
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("from 날짜는 to 날짜보다 이후일 수 없습니다.");
        }
    }

    private Long parseKoreanNumber(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.replaceAll("[^0-9]", "");
        if (normalized.isBlank()) {
            return null;
        }

        try {
            return Long.parseLong(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public record GameChartScenario(
            String stockCode,
            String stockName,
            int lookbackYears,
            String fromDate,
            String toDate,
            List<Long> openPrices,
            List<Long> highPrices,
            List<Long> lowPrices,
            List<Long> closePrices,
            List<Long> volumes
    ) {
    }
}
