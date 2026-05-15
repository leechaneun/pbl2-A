package com.mockinvest.backend.domain.member;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;


@Document(collection = "members")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Member {

    @Id
    private String id; // 데이터베이스가 자동으로 할당하는 고유 ID
    @NotBlank(message = "아이디는 필수입니다")
    private String loginId;

    @NotBlank(message = "비밀번호는 필수입니다")
    private String password;

    private String name;

    private Double balance; // 초기 자산 (예: 10,000,000.0)

    /**
     * 회원가입 시 필요한 최소 정보를 받는 생성자
     */

    //테스트용
    public Member(String loginId, String password, Double balance) {
        this.loginId = loginId;
        this.password = password;
        this.balance = balance;
    }
}