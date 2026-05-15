package com.mockinvest.backend.web;

import com.mockinvest.backend.domain.stock.Stock;
import com.mockinvest.backend.domain.stock.StockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/stocks")
@RequiredArgsConstructor
public class StockController {

    private final StockRepository stockRepository;

  //모든 종목 조회
    @GetMapping
    public List<Stock> getAllStocks() {
        return stockRepository.findAll();
    }
}