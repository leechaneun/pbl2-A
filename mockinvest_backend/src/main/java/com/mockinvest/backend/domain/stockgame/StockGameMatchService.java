package com.mockinvest.backend.domain.stockgame;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mockinvest.backend.domain.member.Member;
import com.mockinvest.backend.domain.member.MemberRepository;
import com.mockinvest.backend.domain.mission.MissionService;
import com.mockinvest.backend.domain.mission.MissionType;
import com.mockinvest.backend.domain.stockgame.history.StockGameMatchHistory1vs1;
import com.mockinvest.backend.domain.stockgame.history.StockGameMatchHistory1vs1Repository;
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
import java.util.Comparator;
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
import java.time.Instant;

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
    private static final double BASE_FEE_RATE = 0.005;
    private static final double DISCOUNT_FEE_RATE = 0.0025;
    private static final long ITEM_EFFECT_DURATION_MS = 60_000L;
    private static final String ITEM_FEE_DISCOUNT = "FEE_DISCOUNT";
    private static final String ITEM_OPPONENT_TRADES = "OPPONENT_TRADES";
    private static final String ITEM_NEXT_SELL_BOOST = "NEXT_SELL_BOOST";
    private static final int TIER_UNIT_SCORE = 200;
    private static final int MAX_TIER_INDEX = 4;
    private static final String[] TIER_NAMES = {"브론즈", "실버", "골드", "플래티넘", "다이아"};

    private final ObjectMapper objectMapper;
    private final StockGameHistoryService stockGameHistoryService;
    private final MemberRepository memberRepository;
    private final StockGameMatchHistory1vs1Repository stockGameMatchHistory1vs1Repository;
    private final MissionService missionService;

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
            case "BUY" -> handleTrade(session, payload, 1);
            case "SELL" -> handleTrade(session, payload, -1);
            case "ITEM_BUY" -> handleItemBuy(session, payload);
            case "ITEM_USE" -> handleItemUse(session, payload);
            default -> sendError(session, "UNSUPPORTED_ACTION", "吏?먰븯吏 ?딅뒗 ?≪뀡?낅땲?? " + action);
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
                        "message", "?ㅻⅨ ?뚮젅?댁뼱 ?곌껐??醫낅즺?섏뼱 寃뚯엫??醫낅즺?섏뿀?듬땲??"
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
            sendError(session, "UNSUPPORTED_MODE", "?꾩옱??1vs1, 1vsALL 紐⑤뱶留?吏?먰빀?덈떎.");
            return;
        }
        if (loginId.isBlank()) {
            sendError(session, "INVALID_LOGIN", "loginId媛 ?꾩슂?⑸땲??");
            return;
        }

        queue1vs1.removeIf(waiter -> waiter.session().getId().equals(session.getId()));
        queue1vsAll.removeIf(waiter -> waiter.session().getId().equals(session.getId()));

        if (MODE_1VS1.equals(mode)) {
            queue1vs1.offer(new PlayerWaiter(session, loginId));
            sendEvent(session, Map.of("type", "QUEUE", "status", "WAITING", "mode", "1vs1", "message", "留ㅼ튂硫붿씠???湲곗뿴???깅줉?섏뿀?듬땲??"));
            tryMatch1vs1();
            return;
        }

        queue1vsAll.offer(new PlayerWaiter(session, loginId));
        sendEvent(session, Map.of(
                "type", "QUEUE",
                "status", "WAITING",
                "mode", "1vsALL",
                "targetPlayers", MODE_1VSALL_PLAYERS,
                "message", "1vsALL ?湲곗뿴???깅줉?섏뿀?듬땲??"
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
                .map(waiter -> createPlayerState(waiter.session(), waiter.loginId()))
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
                .map(waiter -> createPlayerState(waiter.session(), waiter.loginId()))
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
                "테스트 시나리오",
                1,
                "-",
                "-",
                prices
        );
    }

    private void sendMatched(RoomState room) {
        for (PlayerState me : room.getPlayers()) {
            List<Map<String, Object>> opponents = buildOpponents(room, me);
            Member myMember = memberRepository.findByLoginId(me.getLoginId());
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
            payload.put("rankScore", me.getRankScore());
            payload.put("rank", determineTierFromScore(me.getRankScore()));
            payload.put("winRate", calculateWinRate(myMember));
            payload.put("tierUnitScore", TIER_UNIT_SCORE);
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
                endRoomByDisconnect(room, "?뚮젅?댁뼱 ?곌껐 醫낅즺濡?寃뚯엫??醫낅즺?섏뿀?듬땲??");
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
            long now = System.currentTimeMillis();
            for (PlayerState player : room.getPlayers()) {
                player.purgeExpiredEffects(now);
            }

            for (PlayerState me : room.getPlayers()) {
                sendSnapshot(room, me);
            }

            if (room.getRemainingSeconds() == 0) {
                room.setFinished(true);
                room.setTradeLocked(true);
                Map<String, Integer> scoreDeltaByLoginId = applyRankScoreByMatchResult(room);
                for (PlayerState player : room.getPlayers()) {
                    int scoreDelta = scoreDeltaByLoginId.getOrDefault(player.getLoginId(), 0);
                    missionService.completeMission(player.getLoginId(), MissionType.GAME);
                    sendEvent(player.getSession(), Map.of(
                            "type", "GAME_END",
                            "finished", true,
                            "tradeLocked", true,
                            "message", "寃뚯엫 醫낅즺",
                            "rankScore", player.getRankScore(),
                            "rank", determineTierFromScore(player.getRankScore()),
                            "rankScoreDelta", scoreDelta
                    ));
                }
                cleanupRoom(room);
            }
        }
    }

    private void sendSnapshot(RoomState room, PlayerState me) {
        List<Map<String, Object>> opponents = buildOpponents(room, me);
        Member myMember = memberRepository.findByLoginId(me.getLoginId());

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
        payload.put("inventory", new ArrayList<>(me.getInventory()));
        payload.put("activeEffects", serializeActiveEffects(me, System.currentTimeMillis()));
        payload.put("feeRate", resolveFeeRate(me, System.currentTimeMillis()));
        payload.put("tradeLocked", room.isTradeLocked());
        payload.put("finished", room.isFinished());
        payload.put("message", room.isFinished() ? "게임 종료" : "실시간 데이터 동기화 중");
        payload.put("rankScore", me.getRankScore());
        payload.put("rank", determineTierFromScore(me.getRankScore()));
        payload.put("winRate", calculateWinRate(myMember));
        payload.put("tierUnitScore", TIER_UNIT_SCORE);
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
            Member opponentMember = memberRepository.findByLoginId(player.getLoginId());
            opponents.add(Map.of(
                    "loginId", player.getLoginId(),
                    "nickname", player.getNickname(),
                    "rank", determineTierFromScore(player.getRankScore()),
                    "rankScore", player.getRankScore(),
                    "cash", player.getCash(),
                    "totalAsset", calculateTotalAsset(player, room.getCurrentPrice()),
                    "winRate", calculateWinRate(opponentMember)
            ));
        }
        return opponents;
    }

    private long calculateTotalAsset(PlayerState player, long currentPrice) {
        return player.getCash() + ((long) player.getHoldingQty() * currentPrice);
    }

    private void handleTrade(WebSocketSession session, Map<String, Object> payload, int direction) {
        RoomState room = findRoomBySession(session);
        if (room == null) {
            sendError(session, "ROOM_NOT_FOUND", "진행 중인 게임 방을 찾지 못했습니다.");
            return;
        }

        int quantity = resolveTradeQuantity(payload);
        if (quantity < 1) {
            sendError(session, "INVALID_QUANTITY", "1주 이상부터 거래할 수 있습니다.");
            return;
        }

        synchronized (room.getLock()) {
            if (room.isTradeLocked() || room.isFinished()) {
                sendError(session, "TRADE_LOCKED", "?꾩옱??嫄곕옒媛 ?쒗븳?섏뼱 ?덉뒿?덈떎.");
                return;
            }

            PlayerState me = room.getPlayers().stream()
                    .filter(player -> Objects.equals(player.getSession().getId(), session.getId()))
                    .findFirst()
                    .orElse(null);

            if (me == null) {
                sendError(session, "PLAYER_NOT_FOUND", "?꾩옱 諛⑹뿉???뚮젅?댁뼱瑜?李얠? 紐삵뻽?듬땲??");
                return;
            }

            long now = System.currentTimeMillis();
            me.purgeExpiredEffects(now);
            double feeRate = resolveFeeRate(me, now);
            long grossAmount = room.getCurrentPrice() * quantity;
            long fee = Math.round(grossAmount * feeRate);
            if (direction > 0) {
                long totalCost = grossAmount + fee;
                if (me.getCash() < totalCost) {
                    sendEvent(session, Map.of("type", "TRADE_RESULT", "message", "자금 부족", "cash", me.getCash()));
                    return;
                }

                long weighted = me.getAvgPrice() * me.getHoldingQty() + room.getCurrentPrice() * quantity;
                me.setHoldingQty(me.getHoldingQty() + quantity);
                me.setAvgPrice(Math.max(0, Math.round((double) weighted / me.getHoldingQty())));
                me.setCash(me.getCash() - totalCost);
                me.addRecentTrade("매수 " + quantity + "주 @" + room.getCurrentPrice() + "원 (수수료 " + fee + "원)");
                sendEvent(session, Map.of(
                        "type", "TRADE_RESULT",
                        "message", quantity + "주 매수 완료 (수수료 " + fee + "원)",
                        "cash", me.getCash(),
                        "holdingQty", me.getHoldingQty(),
                        "avgPrice", me.getAvgPrice()
                ));
            } else {
                if (me.getHoldingQty() < quantity) {
                    sendEvent(session, Map.of("type", "TRADE_RESULT", "message", "보유 수량 부족", "cash", me.getCash()));
                    return;
                }

                long profit = Math.max(0L, room.getCurrentPrice() - me.getAvgPrice()) * quantity;
                long sellBoostBonus = me.isNextSellBoostReady() ? Math.round(profit * 0.1) : 0L;
                long net = grossAmount - fee + sellBoostBonus;
                me.setCash(me.getCash() + net);
                me.setHoldingQty(me.getHoldingQty() - quantity);
                if (me.getHoldingQty() == 0) {
                    me.setAvgPrice(0);
                }
                if (me.isNextSellBoostReady()) {
                    me.setNextSellBoostReady(false);
                }
                me.addRecentTrade("매도 " + quantity + "주 @" + room.getCurrentPrice() + "원 (수수료 " + fee + "원, 보너스 " + sellBoostBonus + "원)");
                sendEvent(session, Map.of(
                        "type", "TRADE_RESULT",
                        "message", quantity + "주 매도 완료 (수수료 " + fee + "원, 보너스 " + sellBoostBonus + "원)",
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

    private int resolveTradeQuantity(Map<String, Object> payload) {
        Object rawQuantity = payload.get("quantity");
        if (rawQuantity instanceof Number number) {
            return Math.max(1, number.intValue());
        }

        if (rawQuantity instanceof String text) {
            try {
                return Math.max(1, Integer.parseInt(text.trim()));
            } catch (NumberFormatException ignored) {
                return 1;
            }
        }

        return 1;
    }

    private void handleItemBuy(WebSocketSession session, Map<String, Object> payload) {
        RoomState room = findRoomBySession(session);
        if (room == null) {
            sendError(session, "ROOM_NOT_FOUND", "吏꾪뻾 以묒씤 寃뚯엫 諛⑹쓣 李얠? 紐삵뻽?듬땲??");
            return;
        }

        String itemKey = String.valueOf(payload.getOrDefault("itemKey", "")).trim().toUpperCase();
        int itemPrice = getItemPrice(itemKey);
        if (itemPrice <= 0) {
            sendError(session, "INVALID_ITEM", "吏?먰븯吏 ?딅뒗 ?꾩씠?쒖엯?덈떎.");
            return;
        }

        synchronized (room.getLock()) {
            PlayerState me = findPlayer(room, session);
            if (me == null) {
                sendError(session, "PLAYER_NOT_FOUND", "?꾩옱 諛⑹뿉???뚮젅?댁뼱瑜?李얠? 紐삵뻽?듬땲??");
                return;
            }
            if (room.isTradeLocked() || room.isFinished()) {
                sendError(session, "TRADE_LOCKED", "?꾩옱???꾩씠?쒖쓣 ?ъ슜?????놁뒿?덈떎.");
                return;
            }
            if (me.getCash() < itemPrice) {
                sendEvent(session, Map.of("type", "ITEM_RESULT", "message", "?꾩씠??援щℓ ?먭툑??遺議깊빀?덈떎."));
                return;
            }

            me.setCash(me.getCash() - itemPrice);
            me.addInventoryItem(itemKey);
            sendEvent(session, Map.of(
                    "type", "ITEM_RESULT",
                    "message", "?꾩씠??援щℓ ?꾨즺",
                    "cash", me.getCash(),
                    "inventory", new ArrayList<>(me.getInventory()),
                    "activeEffects", serializeActiveEffects(me, System.currentTimeMillis())
            ));
            for (PlayerState player : room.getPlayers()) {
                sendSnapshot(room, player);
            }
        }
    }

    private void handleItemUse(WebSocketSession session, Map<String, Object> payload) {
        RoomState room = findRoomBySession(session);
        if (room == null) {
            sendError(session, "ROOM_NOT_FOUND", "吏꾪뻾 以묒씤 寃뚯엫 諛⑹쓣 李얠? 紐삵뻽?듬땲??");
            return;
        }

        String itemKey = String.valueOf(payload.getOrDefault("itemKey", "")).trim().toUpperCase();
        synchronized (room.getLock()) {
            PlayerState me = findPlayer(room, session);
            if (me == null) {
                sendError(session, "PLAYER_NOT_FOUND", "?꾩옱 諛⑹뿉???뚮젅?댁뼱瑜?李얠? 紐삵뻽?듬땲??");
                return;
            }
            if (room.isTradeLocked() || room.isFinished()) {
                sendError(session, "TRADE_LOCKED", "?꾩옱???꾩씠?쒖쓣 ?ъ슜?????놁뒿?덈떎.");
                return;
            }
            if (!me.consumeInventoryItem(itemKey)) {
                sendEvent(session, Map.of("type", "ITEM_RESULT", "message", "蹂댁쑀 以묒씤 ?꾩씠?쒖씠 ?놁뒿?덈떎."));
                return;
            }

            long now = System.currentTimeMillis();
            me.purgeExpiredEffects(now);
            String message;
            if (ITEM_FEE_DISCOUNT.equals(itemKey)) {
                me.setEffect(ITEM_FEE_DISCOUNT, now + ITEM_EFFECT_DURATION_MS);
                message = "?섏닔猷??좎씤??60珥??숈븞 ?곸슜?⑸땲?? (0.25%)";
            } else if (ITEM_NEXT_SELL_BOOST.equals(itemKey)) {
                me.setNextSellBoostReady(true);
                message = "?ㅼ쓬 留ㅻ룄 ???섏씡瑜?10% 蹂대꼫?ㅺ? ?곸슜?⑸땲??";
            } else if (ITEM_OPPONENT_TRADES.equals(itemKey)) {
                List<String> recent = collectOpponentRecentTrades(room, me);
                message = recent.isEmpty() ? "?곷? 理쒓렐 嫄곕옒 ?댁뿭???놁뒿?덈떎." : "?곷? 理쒓렐 嫄곕옒: " + String.join(" | ", recent);
                sendEvent(session, Map.of("type", "ITEM_RESULT", "opponentTradeLogs", recent));
            } else {
                sendError(session, "INVALID_ITEM", "吏?먰븯吏 ?딅뒗 ?꾩씠?쒖엯?덈떎.");
                return;
            }

            sendEvent(session, Map.of(
                    "type", "ITEM_RESULT",
                    "message", message,
                    "cash", me.getCash(),
                    "inventory", new ArrayList<>(me.getInventory()),
                    "activeEffects", serializeActiveEffects(me, now)
            ));
            for (PlayerState player : room.getPlayers()) {
                sendSnapshot(room, player);
            }
        }
    }

    private PlayerState findPlayer(RoomState room, WebSocketSession session) {
        return room.getPlayers().stream()
                .filter(player -> Objects.equals(player.getSession().getId(), session.getId()))
                .findFirst()
                .orElse(null);
    }

    private int getItemPrice(String itemKey) {
        return switch (itemKey) {
            case ITEM_FEE_DISCOUNT -> 120_000;
            case ITEM_OPPONENT_TRADES -> 90_000;
            case ITEM_NEXT_SELL_BOOST -> 140_000;
            default -> -1;
        };
    }

    private double resolveFeeRate(PlayerState player, long nowEpochMillis) {
        return player.hasActiveEffect(ITEM_FEE_DISCOUNT, nowEpochMillis) ? DISCOUNT_FEE_RATE : BASE_FEE_RATE;
    }

    private List<Map<String, Object>> serializeActiveEffects(PlayerState player, long nowEpochMillis) {
        List<Map<String, Object>> effects = new ArrayList<>();
        player.purgeExpiredEffects(nowEpochMillis);
        for (Map.Entry<String, Long> entry : player.getActiveEffects().entrySet()) {
            effects.add(Map.of("key", entry.getKey(), "expireAt", entry.getValue()));
        }
        if (player.isNextSellBoostReady()) {
            effects.add(Map.of("key", ITEM_NEXT_SELL_BOOST, "expireAt", Long.MAX_VALUE));
        }
        return effects;
    }

    private List<String> collectOpponentRecentTrades(RoomState room, PlayerState me) {
        List<String> history = new ArrayList<>();
        for (PlayerState player : room.getPlayers()) {
            if (player.getSession().getId().equals(me.getSession().getId())) {
                continue;
            }
            int count = 0;
            for (String line : player.getRecentTrades()) {
                history.add(player.getLoginId() + ": " + line);
                count += 1;
                if (count >= 3) {
                    break;
                }
            }
        }
        return history;
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

    private PlayerState createPlayerState(WebSocketSession session, String loginId) {
        Member member = memberRepository.findByLoginId(loginId);
        String nickname = member != null && member.getNickname() != null && !member.getNickname().isBlank()
                ? member.getNickname().trim()
                : loginId;
        int rankScore = member != null && member.getRankScore() != null ? Math.max(0, member.getRankScore()) : 0;
        return new PlayerState(session, loginId, nickname, rankScore, STARTING_CASH);
    }

    private Map<String, Integer> applyRankScoreByMatchResult(RoomState room) {
        List<PlayerState> sortedByAssetDesc = new ArrayList<>(room.getPlayers());
        sortedByAssetDesc.sort(Comparator.comparingLong((PlayerState player) -> calculateTotalAsset(player, room.getCurrentPrice())).reversed());
        boolean isOneVsOneMode = MODE_1VS1.equals(room.getMode());

        Map<String, Integer> deltaByLoginId = new HashMap<>();
        List<Long> totalAssets = sortedByAssetDesc.stream()
                .map(player -> calculateTotalAsset(player, room.getCurrentPrice()))
                .toList();

        for (int index = 0; index < sortedByAssetDesc.size(); index++) {
            PlayerState player = sortedByAssetDesc.get(index);
            int scoreDelta = calculateMatchDelta(room.getMode(), totalAssets, index);
            int nextScore = Math.max(0, player.getRankScore() + scoreDelta);
            player.setRankScore(nextScore);
            deltaByLoginId.put(player.getLoginId(), scoreDelta);

            Member member = memberRepository.findByLoginId(player.getLoginId());
            if (member != null) {
                member.setRankScore(nextScore);
                if (isOneVsOneMode) {
                    int nextPlayCount = Math.max(0, nullToZero(member.getGamePlayCount()) + 1);
                    int nextWinCount = Math.max(0, nullToZero(member.getGameWinCount()) + (isWinner(room.getMode(), totalAssets, index) ? 1 : 0));
                    member.setGamePlayCount(nextPlayCount);
                    member.setGameWinCount(nextWinCount);
                }
                memberRepository.save(member);
            }
        }

        if (isOneVsOneMode) {
            saveOneVsOneMatchHistory(room, sortedByAssetDesc, totalAssets);
        }

        return deltaByLoginId;
    }

    private void saveOneVsOneMatchHistory(RoomState room, List<PlayerState> sortedByAssetDesc, List<Long> totalAssets) {
        if (sortedByAssetDesc.size() != 2 || totalAssets.size() != 2) {
            return;
        }

        long firstAsset = totalAssets.get(0);
        long secondAsset = totalAssets.get(1);
        boolean isDraw = firstAsset == secondAsset;

        List<StockGameMatchHistory1vs1.PlayerRecord> records = new ArrayList<>();
        for (int index = 0; index < sortedByAssetDesc.size(); index++) {
            PlayerState player = sortedByAssetDesc.get(index);
            String result = isDraw ? "DRAW" : (index == 0 ? "WIN" : "LOSE");
            records.add(StockGameMatchHistory1vs1.PlayerRecord.builder()
                    .loginId(player.getLoginId())
                    .nickname(player.getNickname())
                    .finalAsset(totalAssets.get(index))
                    .result(result)
                    .build());
        }

        StockGameMatchHistory1vs1 history = StockGameMatchHistory1vs1.builder()
                .roomId(room.getRoomId())
                .stockCode(room.getStockCode())
                .stockName(room.getStockName())
                .finishedAt(Instant.now())
                .players(records)
                .build();

        stockGameMatchHistory1vs1Repository.save(history);
    }

    private int calculateMatchDelta(String mode, List<Long> totalAssets, int rankingIndex) {
        if (MODE_1VS1.equals(mode)) {
            if (totalAssets.size() < 2) {
                return 0;
            }
            long firstAsset = totalAssets.get(0);
            long secondAsset = totalAssets.get(1);
            if (firstAsset == secondAsset) {
                return 0;
            }
            return rankingIndex == 0 ? 25 : -25;
        }

        return switch (rankingIndex) {
            case 0 -> 30;
            case 1 -> 20;
            case 2 -> 10;
            case 3 -> 0;
            default -> -10;
        };
    }

    private String determineTierFromScore(int rankScore) {
        int safeScore = Math.max(0, rankScore);
        int tierIndex = Math.min(MAX_TIER_INDEX, safeScore / TIER_UNIT_SCORE);
        return TIER_NAMES[tierIndex];
    }

    private boolean isWinner(String mode, List<Long> totalAssets, int rankingIndex) {
        if (rankingIndex != 0 || totalAssets.isEmpty()) {
            return false;
        }
        if (MODE_1VS1.equals(mode) && totalAssets.size() >= 2 && Objects.equals(totalAssets.get(0), totalAssets.get(1))) {
            return false;
        }
        return true;
    }

    private int nullToZero(Integer value) {
        return value == null ? 0 : value;
    }

    private double calculateWinRate(Member member) {
        if (member == null) {
            return 0.0;
        }
        int plays = nullToZero(member.getGamePlayCount());
        int wins = nullToZero(member.getGameWinCount());
        if (plays <= 0) {
            return 0.0;
        }
        return (wins * 100.0) / plays;
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

