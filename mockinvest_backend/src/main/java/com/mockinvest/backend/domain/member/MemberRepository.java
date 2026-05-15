package com.mockinvest.backend.domain.member;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MemberRepository extends MongoRepository<Member, String> {
    //findById, findAll, save, delete 는 자동으로 사용 가능
    Member findByLoginId(String loginId);
}



