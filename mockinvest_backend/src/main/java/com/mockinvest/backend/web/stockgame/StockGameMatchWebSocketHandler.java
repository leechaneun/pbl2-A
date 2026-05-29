package com.mockinvest.backend.web.stockgame;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mockinvest.backend.domain.stockgame.StockGameMatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class StockGameMatchWebSocketHandler extends TextWebSocketHandler {

    private final StockGameMatchService stockGameMatchService;
    private final ObjectMapper objectMapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("StockGame websocket connected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(message.getPayload(), new TypeReference<>() {});
        } catch (Exception e) {
            stockGameMatchService.sendError(session, "INVALID_JSON", "요청 메시지를 파싱하지 못했습니다.");
            return;
        }

        stockGameMatchService.handleMessage(session, payload);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("StockGame websocket transport error [{}]: {}", session.getId(), exception.getMessage());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("StockGame websocket disconnected: {} ({})", session.getId(), status);
        stockGameMatchService.handleDisconnect(session);
    }
}

