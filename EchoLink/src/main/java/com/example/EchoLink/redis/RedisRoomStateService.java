package com.example.EchoLink.redis;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.StringRedisTemplate;
import java.util.Set;


@Service
public class RedisRoomStateService {
    private final StringRedisTemplate redisTemplate;

    public RedisRoomStateService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void addUserToRoom(String room, String username) {
        String key = "room:" + room + ":users";
        try {
            System.out.println("[REDIS DEBUG] addUserToRoom called - key=" + key + " username=" + username);
            System.out.println("[REDIS DEBUG] redisTemplate is null? " + (redisTemplate == null));
            
            Long result = redisTemplate.opsForSet().add(key, username);
            System.out.println("[REDIS DEBUG] Set add result: " + result);
            
            Set<String> members = redisTemplate.opsForSet().members(key);
            System.out.println("[REDIS DEBUG] Members in set after add: " + members);
        } catch (Exception e) {
            System.err.println("[REDIS ERROR] Failed to add user to room: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void removeUserFromRoom(String room, String username) {
        String key = "room:" + room + ":users";
        redisTemplate.opsForSet().remove(key, username);
    }

    public Set<String> getUsersInRoom(String room) {
        String key = "room:" + room + ":users";
        try {
            Set<String> members = redisTemplate.opsForSet().members(key);
            System.out.println("[REDIS DEBUG] getUsersInRoom: key=" + key + " members=" + members);
            return members;
        } catch (Exception e) {
            System.err.println("[REDIS ERROR] Failed to get users from room: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
}
