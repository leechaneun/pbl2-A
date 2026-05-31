package com.mockinvest.backend.domain.stockgame.history;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "stock_game_match_history_1vs1")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockGameMatchHistory1vs1 {
    @Id
    private String id;

    private String roomId;
    private String stockCode;
    private String stockName;
    private Instant finishedAt;
    private List<PlayerRecord> players;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PlayerRecord {
        private String loginId;
        private String nickname;
        private Long finalAsset;
        private String result; // WIN / LOSE / DRAW
    }
}
