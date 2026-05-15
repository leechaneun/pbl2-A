package com.mockinvest.backend.domain.stock;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;


@Document(collection = "stocks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Stock {
    @Id
    private String id;

    private String stockCode;
    private String stockName;
    private Long currentPrice;
    private Double changeRate;
    private LocalDateTime lastUpdated;

}