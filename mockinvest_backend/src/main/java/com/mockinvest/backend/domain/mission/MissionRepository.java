package com.mockinvest.backend.domain.mission;


import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface MissionRepository extends MongoRepository<Mission, String> {
    // 사용자의 아이디로 미션 정보 조회
    Optional<Mission> findByLoginId(String loginId);
}