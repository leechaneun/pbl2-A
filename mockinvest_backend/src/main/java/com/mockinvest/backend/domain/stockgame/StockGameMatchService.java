package com.mockinvest.backend.domain.stockgame;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mockinvest.backend.domain.stockgame.history.StockGameHistoryService;
import com.mockinvest.backend.domain.stockgame.model.PlayerState;
import com.mockinvest.backend.domain.stockgame.model.PlayerWaiter;
import com.mockinvest.backend.domain.stockgame.model.RoomState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockGameMatchService {

    private static final long STARTING_CASH = 5_000_000L;
    private static final int MATCH_SECONDS = 15 * 60;
    private static final int FALLBACK_SCENARIO_LENGTH = 120;
    private static final String MODE_1VS1 = "1VS1";
    private static final String MODE_1VSALL = "1VSALL";
    private static final int MODE_1VSALL_PLAYERS = 5;

    private final ObjectMapper objectMapper;
    private final StockGameHistoryService stockGameHistoryService;

    private final ConcurrentLinkedQueue<PlayerWaiter> queue1vs1 = new ConcurrentLinkedQueue<>();
    private final ConcurrentLinkedQueue<PlayerWaiter> queue1vsAll = new ConcurrentLinkedQueue<>();
    private final ConcurrentHashMap<String, RoomState> roomById = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> roomBySessionId = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    public void handleMessage(WebSocketSession session, Map<String, Object> payload) {
        String action = String.valueOf(payload.getOrDefault("action", "")).trim().toUpperCase();

        if (action.isEmpty()) {
            enqueueMatchmaking(session, payload);
            return;
        }

        switch (action) {
            case "BUY" -> handleTrade(session, 1);
            case "SELL" -> handleTrade(session, -1);
            case "ITEM_BUY", "ITEM_USE" -> sendEvent(session, Map.of(
                    "type", "ITEM_RESULT",
                    "message", "현재 서버 버전에서는 아이템 기능이 간소화되어 있습니다."
            ));
            default -> sendError(session, "UNSUPPORTED_ACTION", "지원하지 않는 액션입니다: " + action);
        }
    }

    public void handleDisconnect(WebSocketSession session) {
        queue1vs1.removeIf(waiter -> waiter.session().getId().equals(session.getId()));
        queue1vsAll.removeIf(waiter -> waiter.session().getId().equals(session.getId()));

        String roomId = roomBySessionId.remove(session.getId());
        if (roomId == null) {
            return;
        }

        RoomState room = roomById.remove(roomId);
        if (room == null) {
            return;
        }

        room.stopTicker();
        for (PlayerState player : room.getPlayers()) {
            roomBySessionId.remove(player.getSession().getId());
            if (!player.getSession().getId().equals(session.getId())) {
                sendEvent(player.getSession(), Map.of(
                        "type", "GAME_END",
                        "finished", true,
                        "tradeLocked", true,
                        "message", "다른 플레이어 연결이 종료되어 게임이 종료되었습니다."
                ));
            }
        }
    }

    public void sendError(WebSocketSession session, String code, String message) {
        sendEvent(session, Map.of(
                "type", "ERROR",
                "code", code,
                "message", message
        ));
    }

    private void enqueueMatchmaking(WebSocketSession session, Map<String, Object> payload) {
        String modeRaw = String.valueOf(payload.getOrDefault("mode", "")).trim();
        String loginId = String.valueOf(payload.getOrDefault("loginId", "")).trim();
        String mode = normalizeMode(modeRaw);

        if (mode == null) {
            sendError(session, "UNSUPPORTED_MODE", "현재는 1vs1, 1vsALL 모드만 지원합니다.");
            return;
        }
        if (loginId.isBlank()) {
            sendError(session, "INVALID_LOGIN", "loginId가 필요합니다.");
            return;
        }

        queue1vs1.removeIf(waiter -> waiter.session().getId().equals(session.getId()));
        queue1vsAll.removeIf(waiter -> waiter.session().getId().equals(session.getId()));

        if (MODE_1VS1.equals(mode)) {
            queue1vs1.offer(new PlayerWaiter(session, loginId));
            sendEvent(session, Map.of("type", "QUEUE", "status", "WAITING", "mode", "1vs1", "message", "매치메이킹 대기열에 등록되었습니다."));
            tryMatch1vs1();
            return;
        }

        queue1vsAll.offer(new PlayerWaiter(session, loginId));
        sendEvent(session, Map.of(
                "type", "QUEUE",
                "status", "WAITING",
                "mode", "1vsALL",
                "targetPlayers", MODE_1VSALL_PLAYERS,
                "message", "1vsALL 대기열에 등록되었습니다."
        ));
        tryMatch1vsAll();
    }

    private String normalizeMode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String compact = raw.trim().replaceAll("[\\s_-]+", "").toUpperCase();
        if (compact.equals("1VS1")) {
            return MODE_1VS1;
        }
        if (compact.equals("1VSALL") || compact.equals("1VALL")) {
            return MODE_1VSALL;
        }
        return null;
    }

    private void tryMatch1vs1() {
        List<PlayerWaiter> waiters = pollAlive(queue1vs1, 2);
        if (waiters.size() < 2) {
            requeue(waiters, queue1vs1);
            return;
        }

        List<PlayerState> players = waiters.stream()
                .map(waiter -> new PlayerState(waiter.session(), waiter.loginId(), STARTING_CASH))
                .toList();
        createAndStartRoom(MODE_1VS1, players);
    }

    private void tryMatch1vsAll() {
        List<PlayerWaiter> waiters = pollAlive(queue1vsAll, MODE_1VSALL_PLAYERS);
        if (waiters.size() < MODE_1VSALL_PLAYERS) {
            requeue(waiters, queue1vsAll);
            return;
        }

        List<PlayerState> players = waiters.stream()
                .map(waiter -> new PlayerState(waiter.session(), waiter.loginId(), STARTING_CASH))
                .toList();
        createAndStartRoom(MODE_1VSALL, players);
    }

    private List<PlayerWaiter> pollAlive(ConcurrentLinkedQueue<PlayerWaiter> queue, int count) {
        List<PlayerWaiter> list = new ArrayList<>();
        while (list.size() < count) {
            PlayerWaiter waiter = queue.poll();
            if (waiter == null) {
                break;
            }
            if (waiter.session().isOpen()) {
                list.add(waiter);
            }
        }
        return list;
    }

    private void requeue(List<PlayerWaiter> waiters, ConcurrentLinkedQueue<PlayerWaiter> queue) {
        for (PlayerWaiter waiter : waiters) {
            queue.offer(waiter);
        }
    }

    private void createAndStartRoom(String mode, List<PlayerState> players) {
        String roomId = "room-" + UUID.randomUUID();
        StockGameHistoryService.GameChartScenario scenario;
        try {
            scenario = stockGameHistoryService.getRandomSixMonthScenario(stockGameHistoryService.getSupportedStockCodes());
        } catch (Exception e) {
            log.warn("stock game history unavailable, fallback scenario applied: {}", e.getMessage());
            scenario = buildFallbackScenario();
        }

        RoomState room = new RoomState(
                roomId,
                mode,
                players,
                MATCH_SECONDS,
                scenario.closePrices(),
                scenario.stockCode(),
                scenario.stockName(),
                scenario.fromDate(),
                scenario.toDate(),
                scenario.lookbackYears()
        );

        roomById.put(roomId, room);
        for (PlayerState player : players) {
            roomBySessionId.put(player.getSession().getId(), roomId);
        }

        sendMatched(room);
        startRoomTicker(room);
    }

    private StockGameHistoryService.GameChartScenario buildFallbackScenario() {
        List<Long> prices = new ArrayList<>();
        long price = 100_000L;
        for (int index = 0; index < FALLBACK_SCENARIO_LENGTH; index += 1) {
            double noise = (ThreadLocalRandom.current().nextDouble() - 0.48) * 0.02;
            price = Math.max(35_000L, Math.round(price * (1 + noise)));
            prices.add(price);
        }

        return new StockGameHistoryService.GameChartScenario(
                "FALLBACK",
                "랜덤 시뮬레이션",
                1,
                "-",
                "-",
                prices
        );
    }

    private void sendMatched(RoomState room) {
        for (PlayerState me : room.getPlayers()) {
            List<Map<String, Object>> opponents = buildOpponents(room, me);
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "MATCHED");
            payload.put("status", "MATCHED");
            payload.put("roomId", room.getRoomId());
            payload.put("mode", MODE_1VSALL.equals(room.getMode()) ? "1vsALL" : "1vs1");
            payload.put("participantCount", room.getPlayers().size());
            payload.put("opponents", opponents);
            payload.put("stockCode", room.getStockCode());
            payload.put("stockName", room.getStockName());
            payload.put("scenarioFrom", room.getScenarioFrom());
            payload.put("scenarioTo", room.getScenarioTo());
            payload.put("lookbackYears", room.getLookbackYears());
            payload.put("currentPrice", room.getCurrentPrice());
            payload.put("prices", room.getPrices());
            if (!opponents.isEmpty()) {
                payload.put("opponent", opponents.get(0));
            }
            sendEvent(me.getSession(), payload);
        }
    }

    private void startRoomTicker(RoomState room) {
        synchronized (room.getLock()) {
            if (room.getTicker() != null && !room.getTicker().isCancelled()) {
                return;
            }

            room.setTicker(scheduler.scheduleAtFixedRate(() -> tickRoom(room.getRoomId()), 1, 1, TimeUnit.SECONDS));
        }
    }

    private void tickRoom(String roomId) {
        RoomState room = roomById.get(roomId);
        if (room == null) {
            return;
        }

        synchronized (room.getLock()) {
            boolean allOpen = room.getPlayers().stream().allMatch(player -> player.getSession().isOpen());
            if (!allOpen) {
                endRoomByDisconnect(room, "플레이어 연결 종료로 게임이 종료되었습니다.");
                return;
            }

            if (room.isFinished()) {
                return;
            }

            room.setRemainingSeconds(Math.max(0, room.getRemainingSeconds() - 1));

            int elapsed = MATCH_SECONDS - room.getRemainingSeconds();
            int scenarioIndex = resolveScenarioIndex(room.getScenarioPrices().size(), elapsed);
            if (!room.getScenarioPrices().isEmpty() && scenarioIndex >= 0 && scenarioIndex < room.getScenarioPrices().size()) {
                room.setCurrentPrice(room.getScenarioPrices().get(scenarioIndex));
                int revealSize = Math.max(1, scenarioIndex + 1);
                room.getPrices().clear();
                room.getPrices().addAll(room.getScenarioPrices().subList(0, revealSize));
            }

            for (PlayerState me : room.getPlayers()) {
                sendSnapshot(room, me);
            }

            if (room.getRemainingSeconds() == 0) {
                room.setFinished(true);
                room.setTradeLocked(true);
                for (PlayerState player : room.getPlayers()) {
                    sendEvent(player.getSession(), Map.of(
                            "type", "GAME_END",
                            "finished", true,
                            "tradeLocked", true,
                            "message", "게임 종료"
                    ));
                }
                cleanupRoom(room);
            }
        }
    }

    private void sendSnapshot(RoomState room, PlayerState me) {
        List<Map<String, Object>> opponents = buildOpponents(room, me);

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "TICK");
        payload.put("roomId", room.getRoomId());
        payload.put("mode", MODE_1VSALL.equals(room.getMode()) ? "1vsALL" : "1vs1");
        payload.put("participantCount", room.getPlayers().size());
        payload.put("remainingSeconds", room.getRemainingSeconds());
        payload.put("currentPrice", room.getCurrentPrice());
        payload.put("prices", room.getPrices());
        payload.put("stockCode", room.getStockCode());
        payload.put("stockName", room.getStockName());
        payload.put("scenarioFrom", room.getScenarioFrom());
        payload.put("scenarioTo", room.getScenarioTo());
        payload.put("lookbackYears", room.getLookbackYears());
        payload.put("cash", me.getCash());
        payload.put("holdingQty", me.getHoldingQty());
        payload.put("avgPrice", me.getAvgPrice());
        payload.put("tradeLocked", room.isTradeLocked());
        payload.put("finished", room.isFinished());
        payload.put("message", room.isFinished() ? "게임 종료" : "실시간 데이터 동기화 중");
        payload.put("opponents", opponents);

        if (!opponents.isEmpty()) {
            payload.put("opponent", opponents.get(0));
            payload.put("opponentCash", opponents.get(0).get("cash"));
        } else {
            payload.put("opponentCash", STARTING_CASH);
        }

        sendEvent(me.getSession(), payload);
    }

    private List<Map<String, Object>> buildOpponents(RoomState room, PlayerState me) {
        List<Map<String, Object>> opponents = new ArrayList<>();
        for (PlayerState player : room.getPlayers()) {
            if (player.getSession().getId().equals(me.getSession().getId())) {
                continue;
            }
            opponents.add(Map.of(
                    "loginId", player.getLoginId(),
                    "nickname", player.getLoginId(),
                    "rank", "브론즈",
                    "cash", player.getCash(),
                    "totalAsset", calculateTotalAsset(player, room.getCurrentPrice()),
                    "winRate", 0.0
            ));
        }
        return opponents;
    }

    private long calculateTotalAsset(PlayerState player, long currentPrice) {
        return player.getCash() + ((long) player.getHoldingQty() * currentPrice);
    }

    private void handleTrade(WebSocketSession session, int direction) {
        RoomState room = findRoomBySession(session);
        if (room == null) {
            sendError(session, "ROOM_NOT_FOUND", "진행 중인 게임 방을 찾지 못했습니다.");
            return;
        }

        synchronized (room.getLock()) {
            if (room.isTradeLocked() || room.isFinished()) {
                sendError(session, "TRADE_LOCKED", "현재는 거래가 제한되어 있습니다.");
                return;
            }

            PlayerState me = room.getPlayers().stream()
                    .filter(player -> Objects.equals(player.getSession().getId(), session.getId()))
                    .findFirst()
                    .orElse(null);

            if (me == null) {
                sendError(session, "PLAYER_NOT_FOUND", "현재 방에서 플레이어를 찾지 못했습니다.");
                return;
            }

            long fee = Math.round(room.getCurrentPrice() * 0.0035);
            if (direction > 0) {
                long totalCost = room.getCurrentPrice() + fee;
                if (me.getCash() < totalCost) {
                    sendEvent(session, Map.of("type", "TRADE_RESULT", "message", "현금 부족", "cash", me.getCash()));
                    return;
                }

                long weighted = me.getAvgPrice() * me.getHoldingQty() + room.getCurrentPrice();
                me.setHoldingQty(me.getHoldingQty() + 1);
                me.setAvgPrice(Math.max(0, Math.round((double) weighted / me.getHoldingQty())));
                me.setCash(me.getCash() - totalCost);
                sendEvent(session, Map.of(
                        "type", "TRADE_RESULT",
                        "message", "1주 매수 완료",
                        "cash", me.getCash(),
                        "holdingQty", me.getHoldingQty(),
                        "avgPrice", me.getAvgPrice()
                ));
            } else {
                if (me.getHoldingQty() < 1) {
                    sendEvent(session, Map.of("type", "TRADE_RESULT", "message", "보유 수량 부족", "cash", me.getCash()));
                    return;
                }

                long net = room.getCurrentPrice() - fee;
                me.setCash(me.getCash() + net);
                me.setHoldingQty(me.getHoldingQty() - 1);
                if (me.getHoldingQty() == 0) {
                    me.setAvgPrice(0);
                }
                sendEvent(session, Map.of(
                        "type", "TRADE_RESULT",
                        "message", "1주 매도 완료",
                        "cash", me.getCash(),
                        "holdingQty", me.getHoldingQty(),
                        "avgPrice", me.getAvgPrice()
                ));
            }

            for (PlayerState player : room.getPlayers()) {
                sendSnapshot(room, player);
            }
        }
    }

    private RoomState findRoomBySession(WebSocketSession session) {
        String roomId = roomBySessionId.get(session.getId());
        if (roomId == null) {
            return null;
        }
        return roomById.get(roomId);
    }

    private void endRoomByDisconnect(RoomState room, String message) {
        room.setFinished(true);
        room.setTradeLocked(true);
        for (PlayerState player : room.getPlayers()) {
            sendEvent(player.getSession(), Map.of(
                    "type", "GAME_END",
                    "finished", true,
                    "tradeLocked", true,
                    "message", message
            ));
        }
        cleanupRoom(room);
    }

    private void cleanupRoom(RoomState room) {
        room.stopTicker();
        roomById.remove(room.getRoomId());
        for (PlayerState player : room.getPlayers()) {
            roomBySessionId.remove(player.getSession().getId());
        }
    }

    private int resolveScenarioIndex(int scenarioSize, int elapsedSeconds) {
        if (scenarioSize <= 1) {
            return 0;
        }
        double progress = Math.max(0, Math.min(1.0, (double) elapsedSeconds / (double) MATCH_SECONDS));
        return Math.min(scenarioSize - 1, (int) Math.floor(progress * (scenarioSize - 1)));
    }

    private void sendEvent(WebSocketSession session, Map<String, Object> event) {
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(event)));
        } catch (IOException e) {
            log.warn("WebSocket send failed [{}]: {}", session.getId(), e.getMessage());
        }
    }
}
