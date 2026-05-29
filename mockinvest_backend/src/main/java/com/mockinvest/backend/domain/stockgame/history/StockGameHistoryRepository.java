package com.mockinvest.backend.domain.stockgame.history;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StockGameHistoryRepository extends MongoRepository<StockGameHistory, String> {
    Optional<StockGameHistory> findByStockCodeAndTradeDate(String stockCode, LocalDate tradeDate);

    List<StockGameHistory> findByStockCodeAndTradeDateBetweenOrderByTradeDateAsc(
            String stockCode,
            LocalDate from,
            LocalDate to
    );
}

