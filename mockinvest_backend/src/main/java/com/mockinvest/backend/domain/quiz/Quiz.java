package com.mockinvest.backend.domain.quiz;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "quizzes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Quiz {

    @Id
    private String id;

    // BASIC, TRADING, ANALYSIS, NEWS, COMMUNITY
    private String type;
    private String quizType;
    private String category;
    private String genre;

    private String question;
    private String quiz;
    private String prompt;
    private String word;

    private String answer;
    private String correctAnswer;
    private String solution;
}
