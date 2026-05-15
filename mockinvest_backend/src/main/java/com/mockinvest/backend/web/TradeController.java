package com.mockinvest.backend.web;

import com.mockinvest.backend.domain.trade.Trade;
import com.mockinvest.backend.domain.trade.TradeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/trade")
@RequiredArgsConstructor
public class TradeController {

    private final TradeService tradeService;

    // 매수
    @PostMapping("/buy")
    public ResponseEntity<String> buy(@RequestBody Map<String, Object> req) {
        try {
            tradeService.buyStock(
                    req.get("loginId").toString(),
                    req.get("stockCode").toString(),
                    Integer.parseInt(req.get("quantity").toString())
            );
            return ResponseEntity.ok("매수 처리가 완료되었습니다.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 매도
    @PostMapping("/sell")
    public ResponseEntity<String> sell(@RequestBody Map<String, Object> req) {
        try {
            tradeService.sellStock(
                    req.get("loginId").toString(),
                    req.get("stockCode").toString(),
                    Integer.parseInt(req.get("quantity").toString())
            );
            return ResponseEntity.ok("매도 처리가 완료되었습니다.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 내 보유 주식 조회
    @GetMapping("/my/{loginId}")
    public ResponseEntity<List<Trade>> getMyTrades(@PathVariable String loginId) {
        return ResponseEntity.ok(tradeService.getMyTrades(loginId));
    }
}