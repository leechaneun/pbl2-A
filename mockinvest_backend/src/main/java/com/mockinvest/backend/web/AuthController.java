package com.mockinvest.backend.web;


import com.mockinvest.backend.domain.member.Member;
import com.mockinvest.backend.domain.member.MemberService;
import com.mockinvest.backend.domain.mission.MissionService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

//검증,세션처리:유동균 mvc2 인강 강의 자료, ResponseEntity: https://burningfalls.github.io/java/what-is-response-entity/참고

@RestController
@RequestMapping("/user")
public class AuthController {

    private final MemberService memberService;
    private final MissionService missionService;//미션 추가

    public AuthController(MemberService memberService, MissionService missionService) {
        this.memberService = memberService;
        this.missionService = missionService;//미션 추가
    }

    //회원가입
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody Member member, BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            return ResponseEntity.badRequest().body(bindingResult.getAllErrors());
        }

        // 초기 자산 1,000만 원 고정
        member.setBalance(10000000.0);

        try {
            Member savedMember = memberService.register(member);
            missionService.getMissionStatus(savedMember.getLoginId());//미션 추가
            return ResponseEntity.ok(savedMember);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

  //로그인
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginData, HttpSession session) {
        String loginId = loginData.get("loginId");
        String password = loginData.get("password");

        try {
            Member member = memberService.login(loginId, password);

            if (member == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("아이디 또는 비밀번호가 틀렸습니다.");
            }

            // 보안을 위해 비밀번호 제거 후 세션 저장
            member.setPassword(null);
            session.setAttribute("loginMember", member);

            return ResponseEntity.ok(member);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(HttpSession session) {
        Member loginMember = (Member) session.getAttribute("loginMember");
        if (loginMember == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        // [수정] 세션 데이터가 아닌 DB에서 최신 정보를 다시 조회해서 반환
        Member freshMember = memberService.findByLoginId(loginMember.getLoginId());
        freshMember.setPassword(null); // 보안
        return ResponseEntity.ok(freshMember);
    }

    //로그아웃
    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok("로그아웃 성공");
    }
}