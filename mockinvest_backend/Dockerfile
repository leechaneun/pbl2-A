# 1단계: 빌드
FROM gradle:8.5-jdk17 AS build
WORKDIR /app
# 권한 문제 방지를 위해 소스 복사 후 실행 권한 부여
COPY . .
RUN chmod +x ./gradlew
RUN ./gradlew build -x test --no-daemon

# 2단계: 실행
FROM openjdk:17-jdk-slim
WORKDIR /app
EXPOSE 8080
# 빌드된 jar 파일 이름을 명확히 지정하거나 와일드카드 사용
COPY --from=build /app/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]