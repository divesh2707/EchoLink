package com.example.EchoLink.room;

import jakarta.persistence.*;
import com.example.EchoLink.user.User;

@Entity
@Table(name = "room_members",
    uniqueConstraints = @UniqueConstraint(columnNames = {"room_id", "user_id"})
)

public class RoomMember {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private User user;

    @ManyToOne(optional = false)
    private Room room;

    public RoomMember() {
    }   

    public RoomMember(User user, Room room) {
        this.user = user;
        this.room = room;
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public Room getRoom() {
        return room;
    }

}
