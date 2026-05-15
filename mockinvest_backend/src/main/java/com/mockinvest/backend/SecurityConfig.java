package com.mockinvest.backend;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.config.Customizer;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // 1. CORS 설정 활성화 (작성하신 CorsConfig 설정을 시큐리티가 사용하게 함)
                .cors(Customizer.withDefaults())

                // 2. CSRF 비활성화 (테스트 단계 및 세션 방식에서 프론트와 통신을 위해 보통 끔)
                .csrf(csrf -> csrf.disable())

                // 3. 요청 권한 설정 [수정됨: /trade/** 및 /missions/** 추가]
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "user/**",
                                "/stocks/**",
                                "/trade/**",     // 주식 거래 관련 API 허용
                                "/missions/**",
                                "/posts/**"
                        ).permitAll() // 지정된 경로들은 누구나 접근 가능
                        .anyRequest().authenticated() // 그 외의 모든 요청은 인증 필요
                )

                // 4. 세션 관리 (세션이 있으면 사용하도록 설정)
                .sessionManagement(session -> session
                        .maximumSessions(1) // 중복 로그인 방지
                );

        return http.build();
    }
}