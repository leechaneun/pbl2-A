package com.mockinvest.backend.domain;

import static org.mockito.ArgumentMatchers.any;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.mockinvest.backend.domain.post.Post;
import com.mockinvest.backend.domain.post.PostRepository;
import com.mockinvest.backend.domain.post.PostService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class PostServiceTest {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private PostService postService;

    @Test
    @DisplayName("진짜 DB에 데이터 저장 및 조회수 확인")
    void realDatabaseTest() {

        Post post = Post.builder()
                .title("진짜 테스트 제목")
                .content("진짜 DB에 들어갈 내용")
                .author("chaneun")
                .build();

        String savedId = postService.createPost(post);

        // when
        postService.getPostDetail(savedId);

        // then
        Post result = postRepository.findById(savedId).get();
        assertThat(result.getViewCount()).isEqualTo(1L);
    }
}