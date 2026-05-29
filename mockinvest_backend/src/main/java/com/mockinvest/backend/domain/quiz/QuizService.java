package com.mockinvest.backend.domain.quiz;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuizService {

    private final QuizRepository quizRepository;
    private static final String RANDOM = "RANDOM";
    private static final Map<String, String> TYPE_ALIASES = Map.ofEntries(
            Map.entry("BASIC", "BASIC"),
            Map.entry("기초", "BASIC"),
            Map.entry("기본", "BASIC"),
            Map.entry("입문", "BASIC"),
            Map.entry("기초용어", "BASIC"),
            Map.entry("기초 용어", "BASIC"),
            Map.entry("기본용어", "BASIC"),
            Map.entry("기본 용어", "BASIC"),
            Map.entry("입문용어", "BASIC"),
            Map.entry("입문 용어", "BASIC"),
            Map.entry("TRADING", "TRADING"),
            Map.entry("매매", "TRADING"),
            Map.entry("트레이딩", "TRADING"),
            Map.entry("거래", "TRADING"),
            Map.entry("매매용어", "TRADING"),
            Map.entry("매매 용어", "TRADING"),
            Map.entry("트레이딩용어", "TRADING"),
            Map.entry("트레이딩 용어", "TRADING"),
            Map.entry("거래용어", "TRADING"),
            Map.entry("거래 용어", "TRADING"),
            Map.entry("ANALYSIS", "ANALYSIS"),
            Map.entry("분석", "ANALYSIS"),
            Map.entry("기업분석", "ANALYSIS"),
            Map.entry("재무분석", "ANALYSIS"),
            Map.entry("밸류에이션", "ANALYSIS"),
            Map.entry("기업분석용어", "ANALYSIS"),
            Map.entry("기업 분석 용어", "ANALYSIS"),
            Map.entry("재무용어", "ANALYSIS"),
            Map.entry("재무 용어", "ANALYSIS"),
            Map.entry("NEWS", "NEWS"),
            Map.entry("뉴스", "NEWS"),
            Map.entry("시황", "NEWS"),
            Map.entry("주식뉴스용어", "NEWS"),
            Map.entry("주식 뉴스 용어", "NEWS"),
            Map.entry("뉴스용어", "NEWS"),
            Map.entry("뉴스 용어", "NEWS"),
            Map.entry("COMMUNITY", "COMMUNITY"),
            Map.entry("커뮤", "COMMUNITY"),
            Map.entry("커뮤니티", "COMMUNITY"),
            Map.entry("게시판", "COMMUNITY"),
            Map.entry("커뮤니티용어", "COMMUNITY"),
            Map.entry("커뮤니티 용어", "COMMUNITY"),
            Map.entry("커뮤용어", "COMMUNITY"),
            Map.entry("커뮤 용어", "COMMUNITY"),
            Map.entry("RANDOM", "RANDOM"),
            Map.entry("랜덤", "RANDOM"),
            Map.entry("전체", "RANDOM"),
            Map.entry("ALL", "RANDOM"),
            Map.entry("MIX", "RANDOM")
    );

    public List<Quiz> getQuizzesByType(String type) {
        String requestType = toCanonicalType(type);
        if (requestType == null || RANDOM.equals(requestType)) {
            return quizRepository.findAll();
        }

        return quizRepository.findAll().stream()
                .filter(quiz -> requestType.equals(toCanonicalType(resolveStoredType(quiz))))
                .collect(Collectors.toList());
    }

    public List<QuizResponse> getQuizResponsesByType(String type) {
        return getQuizzesByType(type).stream()
                .map(this::toResponse)
                .filter(response -> !response.question().isBlank() && !response.answer().isBlank())
                .collect(Collectors.toList());
    }

    private String toCanonicalType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return null;
        }
        String trimmed = rawType.trim();
        String compact = trimmed.replaceAll("[\\s_-]+", "");

        String direct = TYPE_ALIASES.get(trimmed);
        if (direct != null) {
            return direct;
        }

        String byCompact = TYPE_ALIASES.get(compact);
        if (byCompact != null) {
            return byCompact;
        }

        String upper = compact.toUpperCase();
        String byUpper = TYPE_ALIASES.get(upper);
        if (byUpper != null) {
            return byUpper;
        }

        String byKeyword = resolveByKeyword(compact, upper);
        return byKeyword != null ? byKeyword : upper;
    }

    private String resolveByKeyword(String compact, String upper) {
        if (compact.contains("기초") || compact.contains("기본") || compact.contains("입문") || upper.contains("BASIC")) {
            return "BASIC";
        }
        if (compact.contains("매매") || compact.contains("트레이딩") || compact.contains("거래")
                || upper.contains("TRADING") || upper.contains("TRADE")) {
            return "TRADING";
        }
        if (compact.contains("분석") || compact.contains("재무") || compact.contains("밸류")
                || upper.contains("ANALYSIS") || upper.contains("VALUATION")) {
            return "ANALYSIS";
        }
        if (compact.contains("뉴스") || compact.contains("시황") || upper.contains("NEWS")) {
            return "NEWS";
        }
        if (compact.contains("커뮤니티") || compact.contains("커뮤") || compact.contains("게시판")
                || upper.contains("COMMUNITY")) {
            return "COMMUNITY";
        }
        if (compact.contains("랜덤") || compact.contains("전체") || upper.contains("RANDOM")
                || upper.contains("MIX") || upper.contains("ALL")) {
            return RANDOM;
        }
        return null;
    }

    private String resolveStoredType(Quiz quiz) {
        return firstNonBlank(quiz.getType(), quiz.getQuizType(), quiz.getCategory(), quiz.getGenre());
    }

    private QuizResponse toResponse(Quiz quiz) {
        String question = firstNonBlank(quiz.getQuestion(), quiz.getQuiz(), quiz.getPrompt(), quiz.getWord());
        String answer = firstNonBlank(quiz.getAnswer(), quiz.getCorrectAnswer(), quiz.getSolution());
        return new QuizResponse(quiz.getId(), trimOrEmpty(question), trimOrEmpty(answer), resolveStoredType(quiz));
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String trimOrEmpty(String value) {
        return Objects.toString(value, "").trim();
    }

    public record QuizResponse(String id, String question, String answer, String type) {}
}
