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

@SpringBootTest // 실제 스프링 컨텍스트를 로드합니다.
class PostServiceTest {

    @Autowired // @Mock 대신 @Autowired를 써서 진짜 스프링 빈을 가져옵니다.
    private PostRepository postRepository;

    @Autowired // @InjectMocks 대신 @Autowired를 씁니다.
    private PostService postService;

    @Test
    @DisplayName("진짜 DB에 데이터 저장 및 조회수 확인")
    void realDatabaseTest() {
        // given
        // 가짜 설정을 모두 지우고 진짜 데이터를 생성합니다.
        Post post = Post.builder()
                .title("진짜 테스트 제목")
                .content("진짜 DB에 들어갈 내용")
                .author("chaneun")
                .build();

        // 1. 먼저 DB에 저장하여 postId를 생성합니다.
        String savedId = postService.createPost(post);

        // when
        // 2. 서비스를 호출하면 내부에서 findById와 save가 진짜 DB를 상대로 일어납니다.
        postService.getPostDetail(savedId);

        // then
        // 3. 다시 DB에서 꺼내와서 확인해봅니다.
        Post result = postRepository.findById(savedId).get();
        assertThat(result.getViewCount()).isEqualTo(1L);
    }
}