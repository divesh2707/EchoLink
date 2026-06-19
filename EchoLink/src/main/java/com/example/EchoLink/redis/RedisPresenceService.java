package com.example.EchoLink.redis;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import java.util.Map;


@Service
public class RedisPresenceService {
    private final StringRedisTemplate redisTemplate;

    public RedisPresenceService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void updatePresence(String username, String room, boolean muted, boolean deafened, boolean speaking) {
        String key = "presence:" + username;

        redisTemplate.opsForHash().put(key, "room", room);
        redisTemplate.opsForHash().put(key, "muted", String.valueOf(muted));
        redisTemplate.opsForHash().put(key, "deafened", String.valueOf(deafened));
        redisTemplate.opsForHash().put(key, "speaking", String.valueOf(speaking));
        redisTemplate.opsForHash().put(key, "online", "true");
    }

    public void markOffline(String username) {
        String key = "presence:" + username;
        redisTemplate.opsForHash().put(key, "online", "false");
        redisTemplate.opsForHash().put(key, "speaking", "false");
    }

    public Map<Object, Object> getPresence(String username) {
        String key = "presence:" + username;
        return redisTemplate.opsForHash().entries(key);
    }
}
