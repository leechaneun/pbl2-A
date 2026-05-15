package com.mockinvest.backend.domain.trade;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;
import java.util.List;

/**
 * MongoDB와 Trade 엔티티를 연결하는 인터페이스
 */
public interface TradeRepository extends MongoRepository<Trade, String> {
    // 특정 사용자가 특정 종목을 이미 가지고 있는지 조회
    Optional<Trade> findByLoginIdAndStockCode(String loginId, String stockCode);

    // 특정 사용자의 전체 포트폴리오(보유 주식 목록) 조회
    List<Trade> findByLoginId(String loginId);
}