package com.example.EchoLink.redis;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class RedisMessagePublisher {
    private final StringRedisTemplate redisTemplate;

    public RedisMessagePublisher(StringRedisTemplate redisTemplate){
        this.redisTemplate = redisTemplate;
    }

    public void publish(String channel, String message){
        redisTemplate.convertAndSend(channel, message);
    }
}
