package com.mockinvest.backend.domain.stock;


import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;


public interface StockRepository extends MongoRepository<Stock, String> {

    //findById, findAll, save, delete 는 자동으로 사용 가능
    Optional<Stock> findByStockCode(String ticker);

}