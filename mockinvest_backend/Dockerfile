# 1단계: 빌드 (Gradle 8.5, JDK 17 사용)
FROM gradle:8.5-jdk17 AS build
WORKDIR /app
COPY . .
RUN chmod +x ./gradlew
RUN ./gradlew build -x test --no-daemon

# 2단계: 실행 (안정적인 Eclipse Temurin JDK 17 이미지 사용)
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]