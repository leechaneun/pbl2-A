package com.mockinvest.backend.web.quiz;

import com.mockinvest.backend.domain.mission.MissionService;
import com.mockinvest.backend.domain.mission.MissionType;
import com.mockinvest.backend.domain.quiz.QuizService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class QuizController {

    private final QuizService quizService;
    private final MissionService missionService;

    @GetMapping("/quizzes")
    public List<QuizService.QuizResponse> getQuizzes(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String quizType,
            @RequestParam(required = false) String category,
            Principal principal
    ) {
        String selectedType = firstNonBlank(type, quizType, category);
        missionService.completeMission(principal.getName(), MissionType.QUIZ);
        return quizService.getQuizResponsesByType(selectedType);
    }

    @GetMapping("/quizzes/{type}")
    public List<QuizService.QuizResponse> getQuizzesByPathType(@PathVariable String type) {
        return quizService.getQuizResponsesByType(type);
    }

    // 프론트의 후보 엔드포인트 호환용
    @GetMapping({"/quiz", "/quiz/list"})
    public List<QuizService.QuizResponse> getQuizAlias(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String quizType,
            @RequestParam(required = false) String category
    ) {
        String selectedType = firstNonBlank(type, quizType, category);
        return quizService.getQuizResponsesByType(selectedType);
    }

    @GetMapping("/quiz/{type}")
    public List<QuizService.QuizResponse> getQuizAliasByPathType(@PathVariable String type) {
        return quizService.getQuizResponsesByType(type);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
