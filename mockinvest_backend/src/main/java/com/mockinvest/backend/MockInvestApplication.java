package com.mockinvest.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class MockInvestApplication {

	public static void main(String[] args) {

		SpringApplication.run(MockInvestApplication.class, args);
	}
}