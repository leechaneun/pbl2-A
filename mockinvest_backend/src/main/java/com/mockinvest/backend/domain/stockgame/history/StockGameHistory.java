package com.mockinvest.backend.domain.stockgame.history;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

@Document(collection = "stock_game_history")
@CompoundIndex(name = "stockCode_tradeDate_unique", def = "{'stockCode': 1, 'tradeDate': 1}", unique = true)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockGameHistory {
    @Id
    private String id;

    private String stockCode;
    private String stockName;
    private LocalDate tradeDate;

    private Long openPrice;
    private Long highPrice;
    private Long lowPrice;
    private Long closePrice;
    private Long volume;
}

