package com.mockinvest.backend.domain.stockgame.model;

import lombok.Getter;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
public class PlayerState {
    private final WebSocketSession session;
    private final String loginId;
    private final String nickname;
    private int rankScore;
    private long cash;
    private int holdingQty;
    private long avgPrice;
    private final List<String> inventory;
    private final Map<String, Long> activeEffects;
    private boolean nextSellBoostReady;
    private final List<String> recentTrades;

    public PlayerState(WebSocketSession session, String loginId, String nickname, int rankScore, long startingCash) {
        this.session = session;
        this.loginId = loginId;
        this.nickname = nickname;
        this.rankScore = rankScore;
        this.cash = startingCash;
        this.holdingQty = 0;
        this.avgPrice = 0;
        this.inventory = new ArrayList<>();
        this.activeEffects = new HashMap<>();
        this.nextSellBoostReady = false;
        this.recentTrades = new ArrayList<>();
    }

    public void setCash(long cash) {
        this.cash = cash;
    }

    public void setHoldingQty(int holdingQty) {
        this.holdingQty = holdingQty;
    }

    public void setAvgPrice(long avgPrice) {
        this.avgPrice = avgPrice;
    }

    public void setRankScore(int rankScore) {
        this.rankScore = rankScore;
    }

    public void addInventoryItem(String itemKey) {
        this.inventory.add(itemKey);
    }

    public boolean consumeInventoryItem(String itemKey) {
        int index = this.inventory.indexOf(itemKey);
        if (index < 0) {
            return false;
        }
        this.inventory.remove(index);
        return true;
    }

    public void setEffect(String effectKey, long expireAt) {
        this.activeEffects.put(effectKey, expireAt);
    }

    public void clearEffect(String effectKey) {
        this.activeEffects.remove(effectKey);
    }

    public boolean hasActiveEffect(String effectKey, long nowEpochMillis) {
        Long expireAt = this.activeEffects.get(effectKey);
        return expireAt != null && expireAt > nowEpochMillis;
    }

    public void purgeExpiredEffects(long nowEpochMillis) {
        this.activeEffects.entrySet().removeIf(entry -> entry.getValue() <= nowEpochMillis);
    }

    public void setNextSellBoostReady(boolean ready) {
        this.nextSellBoostReady = ready;
    }

    public void addRecentTrade(String history) {
        this.recentTrades.add(0, history);
        if (this.recentTrades.size() > 8) {
            this.recentTrades.remove(this.recentTrades.size() - 1);
        }
    }
}
