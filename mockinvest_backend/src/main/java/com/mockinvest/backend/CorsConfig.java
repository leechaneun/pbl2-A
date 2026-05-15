package com.mockinvest.backend;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**") // 모든 API 경로에 대해
                .allowedOriginPatterns(
                        "http://localhost:5173",
                        "https://sandbar-precinct-quilt.ngrok-free.dev" // 앞에 공백이 없는지 꼭 확인하세요!
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // 허용할 HTTP 메서드
                .allowedHeaders("*") // 모든 헤더 허용
                .allowCredentials(true) // 세션 쿠키(JSESSIONID) 전송을 위해 필수
                .maxAge(3600); // 프리플라이트 요청 캐싱 시간 (1시간)
    }
}