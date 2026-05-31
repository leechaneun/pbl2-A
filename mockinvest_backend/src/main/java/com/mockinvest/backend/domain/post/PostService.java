package com.mockinvest.backend.domain.post;


import com.mockinvest.backend.domain.mission.MissionService;
import com.mockinvest.backend.domain.mission.MissionType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final MissionService missionService;//미션 추가
    //게시글 작성
    public String createPost(Post post) {
        String postId = postRepository.save(post).getPostId();
        missionService.completeMission(post.getAuthor(), MissionType.POST); //미션추가(게시글 작성)
        return postId;
    }
    //게시글 상세 조회
    public Post getPostDetail(String postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));
        post.incrementViewCount();
        return postRepository.save(post);
    }
    //좋아요
    public void togglePostLike(String postId, String loginId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));
        post.toggleLike(loginId);
        postRepository.save(post);

        // 미션 추가(좋아요)
        missionService.completeMission(loginId, MissionType.LIKE);
    }

    // 댓글 작성
    public void addComment(String postId, String content, String author) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));
        post.addComment(content, author);
        postRepository.save(post);

        // 미션 추가(댓글 작성)
        missionService.completeMission(author, MissionType.COMMENT);
    }

    public List<Post> findAllPosts() {
        return postRepository.findAll();
    }
}
