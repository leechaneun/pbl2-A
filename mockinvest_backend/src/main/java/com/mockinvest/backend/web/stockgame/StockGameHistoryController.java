package com.mockinvest.backend.web.stockgame;

import com.mockinvest.backend.domain.stockgame.history.StockGameHistory;
import com.mockinvest.backend.domain.stockgame.history.StockGameHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/stock-game/stocks")
@RequiredArgsConstructor
public class StockGameHistoryController {

    private final StockGameHistoryService stockGameHistoryService;

    @GetMapping("/codes")
    public List<String> getSupportedCodes() {
        return stockGameHistoryService.getSupportedStockCodes();
    }

    @GetMapping("/history")
    public List<StockGameHistory> getHistory(
            @RequestParam String stockCode,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return stockGameHistoryService.getStockHistory(stockCode, from, to);
    }

    @PostMapping("/history/sync")
    public ResponseEntity<Map<String, Object>> syncHistory(
            @RequestParam(required = false) String stockCode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        LocalDate resolvedTo = to == null ? LocalDate.now() : to;
        LocalDate resolvedFrom = from == null ? resolvedTo.minusYears(3) : from;

        int savedCount;
        if (stockCode == null || stockCode.isBlank()) {
            savedCount = stockGameHistoryService.syncThreeYearsForAllStocks();
        } else {
            savedCount = stockGameHistoryService.syncStockHistory(stockCode.trim(), resolvedFrom, resolvedTo);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stockCode", stockCode == null || stockCode.isBlank() ? "ALL_40_CODES" : stockCode.trim());
        result.put("from", resolvedFrom);
        result.put("to", resolvedTo);
        result.put("savedCount", savedCount);
        return ResponseEntity.ok(result);
    }
}

