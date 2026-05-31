package com.mockinvest.backend.domain.member;


import org.springframework.stereotype.Service;

import java.util.List;


@Service
public class MemberService {

    private final MemberRepository memberRepository;

    public MemberService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    // 회원가입 (중복 아이디 체크)
    public Member register(Member member) {
        if (memberRepository.findByLoginId(member.getLoginId()) != null) {
            throw new IllegalArgumentException("이미 존재하는 로그인 아이디입니다.");
        }
        String nickname = member.getNickname();
        if (nickname != null && !nickname.trim().isEmpty() && memberRepository.findByNickname(nickname.trim()) != null) {
            throw new IllegalArgumentException("중복된 닉네임입니다.");
        }
        return memberRepository.save(member);
    }

    // 로그인
    public Member login(String loginId, String password) {
        Member member = memberRepository.findByLoginId(loginId);
        if (member == null) {
            throw new IllegalArgumentException("존재하지 않는 아이디입니다.");
        }
        if (!member.getPassword().equals(password)) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }
        return member;
    }

    // 수정: 로그아웃 컨트롤러에서 처리
    public void logout() {
        // HttpSession.invalidate()
    }

    // ID로 회원 조회
    public Member getMember(String id) {
        return memberRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("회원이 존재하지 않습니다."));
    }

    // 로그인 아이디로 회원 조회
    public Member findByLoginId(String loginId) {
        return memberRepository.findByLoginId(loginId);
    }

    // 모든 회원 조회
    public List<Member> findAll() {
        return memberRepository.findAll();
    }
}
