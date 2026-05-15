package com.mockinvest.backend.web;


import com.mockinvest.backend.domain.post.Post;
import com.mockinvest.backend.domain.post.PostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    //전체 조회
    @GetMapping
    public ResponseEntity<List<Post>> getAllPosts() {
        return ResponseEntity.ok(postService.findAllPosts());
    }
    //상세조회
    @GetMapping("/{postId}")
    public ResponseEntity<Post> getPost(@PathVariable String postId) {
        return ResponseEntity.ok(postService.getPostDetail(postId));
    }
    //게시글 작성
    @PostMapping
    public ResponseEntity<String> savePost(@RequestBody Post post) {
        return ResponseEntity.ok(postService.createPost(post));
    }
    // 좋아요
    @PostMapping("/{postId}/like")
    public ResponseEntity<Void> toggleLike(@PathVariable String postId, @RequestBody Map<String, String> body) {
        postService.togglePostLike(postId, body.get("loginId"));
        return ResponseEntity.ok().build();
    }

    // 댓글 작성
    @PostMapping("/{postId}/comments")
    public ResponseEntity<Void> addComment(
            @PathVariable String postId,
            @RequestBody Map<String, String> body
    ) {
        postService.addComment(postId, body.get("content"), body.get("author"));
        return ResponseEntity.ok().build();
    }
}