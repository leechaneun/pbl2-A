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
    private final List<Long> scenarioOpenPrices;
    private final List<Long> scenarioHighPrices;
    private final List<Long> scenarioLowPrices;
    private final List<Long> scenarioVolumes;
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
    private long currentOpenPrice;
    @Setter
    private long currentHighPrice;
    @Setter
    private long currentLowPrice;
    @Setter
    private long currentVolume;
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
            List<Long> scenarioOpenPrices,
            List<Long> scenarioHighPrices,
            List<Long> scenarioLowPrices,
            List<Long> scenarioVolumes,
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
        this.scenarioOpenPrices = scenarioOpenPrices == null ? List.of() : scenarioOpenPrices;
        this.scenarioHighPrices = scenarioHighPrices == null ? List.of() : scenarioHighPrices;
        this.scenarioLowPrices = scenarioLowPrices == null ? List.of() : scenarioLowPrices;
        this.scenarioVolumes = scenarioVolumes == null ? List.of() : scenarioVolumes;
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.scenarioFrom = scenarioFrom;
        this.scenarioTo = scenarioTo;
        this.lookbackYears = lookbackYears;
        this.remainingSeconds = matchSeconds;
        this.currentPrice = this.scenarioPrices.isEmpty() ? 100_000L : this.scenarioPrices.get(0);
        this.currentOpenPrice = this.scenarioOpenPrices.isEmpty() ? this.currentPrice : this.scenarioOpenPrices.get(0);
        this.currentHighPrice = this.scenarioHighPrices.isEmpty() ? this.currentPrice : this.scenarioHighPrices.get(0);
        this.currentLowPrice = this.scenarioLowPrices.isEmpty() ? this.currentPrice : this.scenarioLowPrices.get(0);
        this.currentVolume = this.scenarioVolumes.isEmpty() ? 0L : this.scenarioVolumes.get(0);
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
