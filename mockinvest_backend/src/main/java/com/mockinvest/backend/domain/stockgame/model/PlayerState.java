package com.mockinvest.backend.domain.stockgame.model;

import lombok.Getter;
import org.springframework.web.socket.WebSocketSession;

@Getter
public class PlayerState {
    private final WebSocketSession session;
    private final String loginId;
    private long cash;
    private int holdingQty;
    private long avgPrice;

    public PlayerState(WebSocketSession session, String loginId, long startingCash) {
        this.session = session;
        this.loginId = loginId;
        this.cash = startingCash;
        this.holdingQty = 0;
        this.avgPrice = 0;
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
}

