package com.mockinvest.backend.web;

import com.mockinvest.backend.domain.member.Member;
import com.mockinvest.backend.domain.mission.MissionService;
import com.mockinvest.backend.domain.mission.MissionType;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/missions")
@RequiredArgsConstructor
public class MissionController {

    private final MissionService missionService;

    // 미션 상태 조회
    @GetMapping("/{loginId}")
    public ResponseEntity<?> getMissions(@PathVariable String loginId, HttpSession session) {
        // [개선] 본인 확인 로직
        Member loginMember = (Member) session.getAttribute("loginMember");
        if (loginMember == null || !loginMember.getLoginId().equals(loginId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("본인의 미션 정보만 조회할 수 있습니다.");
        }

        return ResponseEntity.ok(missionService.getMissionStatus(loginId));
    }

    // 보상 수령 요청
    @PostMapping("/claim")
    public ResponseEntity<String> claimReward(@RequestBody Map<String, String> body, HttpSession session) {
        String loginId = body.get("loginId");

        // [개선] 본인 확인 로직
        Member loginMember = (Member) session.getAttribute("loginMember");
        if (loginMember == null || !loginMember.getLoginId().equals(loginId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("본인만 보상을 수령할 수 있습니다.");
        }

        try {
            MissionType type = MissionType.valueOf(body.get("type").toUpperCase());
            missionService.claimReward(loginId, type);
            return ResponseEntity.ok(type.getDescription() + " 보상 " + type.getRewardAmount() + "원이 지급되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("잘못된 미션 타입입니다.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 미션 수동 완료 처리 (필요 시 본인 확인 추가)
    @PostMapping("/complete")
    public ResponseEntity<?> completeMission(@RequestBody Map<String, String> body, HttpSession session) {
        String loginId = body.get("loginId");

        // [개선] 본인 확인 로직
        Member loginMember = (Member) session.getAttribute("loginMember");
        if (loginMember == null || !loginMember.getLoginId().equals(loginId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        MissionType type = MissionType.valueOf(body.get("type").toUpperCase());
        missionService.completeMission(loginId, type);
        return ResponseEntity.ok().build();
    }
}