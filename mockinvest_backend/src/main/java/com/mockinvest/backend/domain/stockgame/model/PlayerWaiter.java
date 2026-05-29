package com.mockinvest.backend.domain.stockgame.model;

import org.springframework.web.socket.WebSocketSession;

public record PlayerWaiter(WebSocketSession session, String loginId) {
}

