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
                // 1. CORS 설정 활성화
                .cors(Customizer.withDefaults())

                // 2. CSRF 비활성화
                .csrf(csrf -> csrf.disable())

                // 3. 요청 권한 설정
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/user/**",
                                "/stocks/**",
                                "/trade/**",
                                "/ws/**",
                                "/matchmaking/**",
                                "/stock-game/**",
                                "/missions/**",
                                "/posts/**",
                                "/mypage/**",
                                "/quiz/**",
                                "/quizzes/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )

                // 4. 세션 관리
                .sessionManagement(session -> session
                        .maximumSessions(1) // 중복 로그인 방지
                );

        return http.build();
    }
}
