package com.mockinvest.backend.domain.stockgame;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StockGameMatchServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final StockGameMatchService stockGameMatchService = new StockGameMatchService(objectMapper);
    private final List<WebSocketSession> openedSessions = new ArrayList<>();

    @AfterEach
    void tearDown() {
        for (WebSocketSession session : openedSessions) {
            stockGameMatchService.handleDisconnect(session);
        }
    }

    @Test
    @DisplayName("1vs1 매치메이킹 요청 2건이 들어오면 양쪽 세션 모두 MATCHED 이벤트를 받는다")
    void matchmakingShouldMatchTwoPlayersAndEmitMatchedEvent() throws Exception {
        CapturedSession first = createSession("session-a");
        CapturedSession second = createSession("session-b");

        stockGameMatchService.handleMessage(first.session(), Map.of("mode", "1vs1", "loginId", "alice"));
        stockGameMatchService.handleMessage(second.session(), Map.of("mode", "1vs1", "loginId", "bob"));

        Thread.sleep(150);

        JsonNode firstMatched = findEvent(first.messages(), "MATCHED");
        JsonNode secondMatched = findEvent(second.messages(), "MATCHED");

        assertThat(firstMatched).as("first player should receive MATCHED event").isNotNull();
        assertThat(secondMatched).as("second player should receive MATCHED event").isNotNull();
        assertThat(firstMatched.get("roomId").asText()).isNotBlank();
        assertThat(secondMatched.get("roomId").asText()).isNotBlank();
        assertThat(firstMatched.get("roomId").asText()).isEqualTo(secondMatched.get("roomId").asText());
    }

    private CapturedSession createSession(String sessionId) throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        List<String> messages = new CopyOnWriteArrayList<>();

        when(session.getId()).thenReturn(sessionId);
        when(session.isOpen()).thenReturn(true);
        doAnswer(invocation -> {
            TextMessage textMessage = invocation.getArgument(0);
            messages.add(textMessage.getPayload());
            return null;
        }).when(session).sendMessage(org.mockito.ArgumentMatchers.any(TextMessage.class));

        openedSessions.add(session);
        return new CapturedSession(session, messages);
    }

    private JsonNode findEvent(List<String> payloads, String eventType) throws Exception {
        for (String payload : payloads) {
            JsonNode node = objectMapper.readTree(payload);
            String type = node.path("type").asText("");
            if (eventType.equalsIgnoreCase(type)) {
                return node;
            }
        }
        return null;
    }

    private record CapturedSession(WebSocketSession session, List<String> messages) {
    }
}

