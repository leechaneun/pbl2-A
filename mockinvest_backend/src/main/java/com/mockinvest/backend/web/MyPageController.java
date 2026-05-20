package com.mockinvest.backend.web;

import com.mockinvest.backend.domain.member.Member;
import com.mockinvest.backend.domain.mypage.MyPageResponseDto;
import com.mockinvest.backend.domain.mypage.MyPageService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/mypage")
@RequiredArgsConstructor
public class MyPageController {

    private final MyPageService myPageService;

    @GetMapping
    public ResponseEntity<?> getMyPage(HttpSession session) {
        // AuthController와 동일한 방식으로 세션에서 유저 확인 및 보안 검증
        Member loginMember = (Member) session.getAttribute("loginMember");
        if (loginMember == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        try {
            MyPageResponseDto myPageData = myPageService.getMyPageData(loginMember.getLoginId());
            return ResponseEntity.ok(myPageData);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}