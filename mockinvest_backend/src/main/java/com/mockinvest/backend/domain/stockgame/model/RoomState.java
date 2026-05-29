package com.mockinvest.backend.domain.stockgame.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ScheduledFuture;

@Getter
public class RoomState {
    private final Object lock = new Object();
    private final String roomId;
    private final String mode;
    private final List<PlayerState> players;
    private final List<Long> prices = new ArrayList<>();
    private final List<Long> scenarioPrices;
    private final String stockCode;
    private final String stockName;
    private final String scenarioFrom;
    private final String scenarioTo;
    private final int lookbackYears;
    @Setter
    private int remainingSeconds;
    @Setter
    private long currentPrice;
    @Setter
    private boolean tradeLocked;
    @Setter
    private boolean finished;
    @Setter
    private ScheduledFuture<?> ticker;

    public RoomState(
            String roomId,
            String mode,
            List<PlayerState> players,
            int matchSeconds,
            List<Long> scenarioPrices,
            String stockCode,
            String stockName,
            String scenarioFrom,
            String scenarioTo,
            int lookbackYears
    ) {
        this.roomId = roomId;
        this.mode = mode;
        this.players = players;
        this.scenarioPrices = scenarioPrices == null ? List.of() : scenarioPrices;
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.scenarioFrom = scenarioFrom;
        this.scenarioTo = scenarioTo;
        this.lookbackYears = lookbackYears;
        this.remainingSeconds = matchSeconds;
        this.currentPrice = this.scenarioPrices.isEmpty() ? 100_000L : this.scenarioPrices.get(0);
        this.tradeLocked = false;
        this.finished = false;
        this.prices.add(this.currentPrice);
    }

    public void stopTicker() {
        if (ticker != null) {
            ticker.cancel(true);
        }
    }
}
