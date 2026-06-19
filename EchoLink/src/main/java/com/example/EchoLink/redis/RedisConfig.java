package com.example.EchoLink.redis;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
public class RedisConfig {

    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        System.out.println("[REDIS CONFIG] Creating LettuceConnectionFactory...");
        return new LettuceConnectionFactory();
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory redisConnectionFactory) {
        System.out.println("[REDIS CONFIG] Creating StringRedisTemplate with factory: " + redisConnectionFactory);
        StringRedisTemplate template = new StringRedisTemplate(redisConnectionFactory);
        
        // Test connection
        try {
            template.getConnectionFactory().getConnection().ping();
            System.out.println("[REDIS CONFIG] ✓ Redis connection successful!");
        } catch (Exception e) {
            System.err.println("[REDIS CONFIG] ✗ Redis connection failed: " + e.getMessage());
            e.printStackTrace();
        }
        
        return template;
    }
}
