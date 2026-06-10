package com.mockinvest.backend.domain.stockgame;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mockinvest.backend.domain.member.MemberRepository;
import com.mockinvest.backend.domain.mission.MissionService;
import com.mockinvest.backend.domain.stockgame.history.StockGameMatchHistory1vs1Repository;
import com.mockinvest.backend.domain.stockgame.history.StockGameHistoryService;
import org.junit.jupiter.api.BeforeEach;
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
    private final StockGameHistoryService stockGameHistoryService = mock(StockGameHistoryService.class);
    private final MemberRepository memberRepository = mock(MemberRepository.class);
    private final StockGameMatchHistory1vs1Repository stockGameMatchHistory1vs1Repository = mock(StockGameMatchHistory1vs1Repository.class);
    private final MissionService missionService = mock(MissionService.class);
    private final StockGameMatchService stockGameMatchService =
            new StockGameMatchService(objectMapper, stockGameHistoryService, memberRepository, stockGameMatchHistory1vs1Repository, missionService);
    private final List<WebSocketSession> openedSessions = new ArrayList<>();

    @BeforeEach
    void setUp() {
        List<String> supportedCodes = List.of("TEST");
        StockGameHistoryService.GameChartScenario scenario = new StockGameHistoryService.GameChartScenario(
                "TEST",
                "테스트 종목",
                1,
                "2025-01-01",
                "2025-06-30",
                List.of(99_000L, 100_500L, 101_000L, 101_500L, 100_000L),
                List.of(101_000L, 102_000L, 103_000L, 103_500L, 104_000L),
                List.of(98_500L, 100_000L, 100_500L, 98_500L, 99_500L),
                List.of(100_000L, 101_000L, 102_000L, 99_000L, 103_000L),
                List.of(1_250_000L, 1_180_000L, 1_420_000L, 1_360_000L, 1_510_000L)
        );

        when(stockGameHistoryService.getSupportedStockCodes()).thenReturn(supportedCodes);
        when(stockGameHistoryService.getRandomSixMonthScenario(supportedCodes)).thenReturn(scenario);
    }

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
        assertThat(firstMatched.path("currentHighPrice").asLong()).isEqualTo(101_000L);
        assertThat(firstMatched.path("currentLowPrice").asLong()).isEqualTo(98_500L);
        assertThat(firstMatched.path("highPrices").size()).isEqualTo(1);
        assertThat(firstMatched.path("lowPrices").size()).isEqualTo(1);
        assertThat(firstMatched.path("volumes").size()).isEqualTo(1);
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
