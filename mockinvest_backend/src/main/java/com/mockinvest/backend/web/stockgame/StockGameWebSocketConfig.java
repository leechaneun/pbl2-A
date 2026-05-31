package com.mockinvest.backend.web.stockgame;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class StockGameWebSocketConfig implements WebSocketConfigurer {

    private final StockGameMatchWebSocketHandler stockGameMatchWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(stockGameMatchWebSocketHandler, "/ws/matchmaking", "/ws/match", "/matchmaking/ws")
                .setAllowedOriginPatterns(
                       // "http://localhost:5173",
                       // "https://sandbar-precinct-quilt.ngrok-free.dev",
                        "https://pbl2-a.vercel.app",
                        "https://pbl2-a.onrender.com"
                );
    }
}

