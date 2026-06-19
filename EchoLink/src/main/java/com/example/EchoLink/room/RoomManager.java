package com.example.EchoLink.room;

import org.springframework.stereotype.Component;
import jakarta.transaction.Transactional;
import com.example.EchoLink.user.User;
import com.example.EchoLink.user.UserRepository;
import java.util.List;
import java.util.Set;
import com.example.EchoLink.redis.RedisRoomStateService;

@Component
public class RoomManager {
    
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RedisRoomStateService redisRoomStateService;

    public RoomManager(UserRepository userRepository, RoomRepository roomRepository, RoomMemberRepository roomMemberRepository, RedisRoomStateService redisRoomStateService) {
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.roomMemberRepository = roomMemberRepository;
        this.redisRoomStateService = redisRoomStateService;
    }

    @Transactional
    public void joinRoom(String roomName, String userName){
        Room room = roomRepository.findByName(roomName)
                .orElseGet(() -> roomRepository.save(new Room(roomName)));
        User user = userRepository.findByUsername(userName)
                .orElseGet(() -> userRepository.save(new User(userName)));

        roomMemberRepository.findByUserAndRoom(user, room)
                .orElseGet(() -> roomMemberRepository.save(new RoomMember(user, room)));
        redisRoomStateService.addUserToRoom(roomName, userName);
    }

    @Transactional
    public void leaveRoom(String roomName, String userName){
        User user = userRepository.findByUsername(userName)
                .orElse(null);
        Room room = roomRepository.findByName(roomName)
                .orElse(null);

                if(user == null || room == null){
                    return;
                }
        roomMemberRepository.deleteByUserAndRoom(user, room);
        redisRoomStateService.removeUserFromRoom(roomName, userName);
            
    }

    public List<String> listUsers(String roomName){
        Set<String> redisUsers = redisRoomStateService.getUsersInRoom(roomName);
        if(redisUsers != null && !redisUsers.isEmpty()){
            return redisUsers.stream().toList();
        }

        Room room = roomRepository.findByName(roomName)
                .orElse(null);
        if(room == null){
            return List.of();
        }
        return roomMemberRepository.findByRoom(room).stream()
                .map(roomMember -> roomMember.getUser().getUsername())
                .toList();
    }
}
