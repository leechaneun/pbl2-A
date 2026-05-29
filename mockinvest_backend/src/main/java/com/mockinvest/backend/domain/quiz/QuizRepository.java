package com.mockinvest.backend.domain.quiz;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface QuizRepository extends MongoRepository<Quiz, String> {
    List<Quiz> findByTypeIgnoreCase(String type);
}
