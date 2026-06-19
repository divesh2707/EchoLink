package com.example.EchoLink.room;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import com.example.EchoLink.user.User;

public interface RoomMemberRepository extends JpaRepository<RoomMember, Long> {
    List<RoomMember> findByRoom(Room room);
    Optional<RoomMember> findByUserAndRoom(User user, Room room);
    void deleteByUserAndRoom(User user, Room room);
}