package com.mockinvest.backend.domain.post;


import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "posts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Post {

    @Id
    private String postId;

    private String title;
    private String content;
    private String author;
    private String stockCode;
    private String stockName;
    private String position;
    private Double yield;

    private Long viewCount = 0L;
    private List<String> likedUsers = new ArrayList<>();

    // [추가] 댓글 리스트
    private List<Comment> comments = new ArrayList<>();

    @Builder
    public Post(String title, String content, String author, String stockCode, String stockName, String position, Double yield) {
        this.title = title;
        this.content = content;
        this.author = author;
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.position = position;
        this.yield = yield;
    }

    public void incrementViewCount() {
        this.viewCount++;
    }

    public void toggleLike(String loginId) {
        if (this.likedUsers.contains(loginId)) {
            this.likedUsers.remove(loginId);
        } else {
            this.likedUsers.add(loginId);
        }
    }

    // [비즈니스 로직] 댓글 추가
    public void addComment(String content, String author) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        this.comments.add(new Comment(content, author, timestamp));
    }

    // 내부 클래스로 댓글 구조 정의
    @Getter
    @NoArgsConstructor
    public static class Comment {
        private String content;
        private String author;
        private String createdAt;

        public Comment(String content, String author, String createdAt) {
            this.content = content;
            this.author = author;
            this.createdAt = createdAt;
        }
    }
}