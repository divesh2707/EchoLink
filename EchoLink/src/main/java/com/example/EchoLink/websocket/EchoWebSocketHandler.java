package com.example.EchoLink.websocket;

import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.CloseStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.EchoLink.redis.RedisMessagePublisher;
import com.example.EchoLink.redis.RedisPresenceService;
import com.example.EchoLink.room.RoomManager;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class EchoWebSocketHandler extends TextWebSocketHandler {

    private final RoomManager roomManager;
    private final ConnectionManager connectionManager;
    private final ObjectMapper objectMapper;
    private final RedisPresenceService redisPresenceService;
    private final RedisMessagePublisher redisMessagePublisher;
    private final ChannelTopic signalingTopic;
    private final Map<String, String> roomByUsername = new ConcurrentHashMap<>();

    public EchoWebSocketHandler(RoomManager roomManager, ConnectionManager connectionManager, RedisPresenceService redisPresenceService, RedisMessagePublisher redisMessagePublisher, ChannelTopic signalingTopic) {
        this.roomManager = roomManager;
        this.connectionManager = connectionManager;
        this.objectMapper = new ObjectMapper();
        this.redisPresenceService = redisPresenceService;
        this.redisMessagePublisher = redisMessagePublisher;
        this.signalingTopic = signalingTopic;

    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("Client connected: " + session.getId());

        session.sendMessage(new TextMessage("{\"type\":\"connected\",\"sessionId\":\"" + session.getId() + "\"}"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        System.out.println("Raw message received " + payload);

        SignalMessage signalMessage = objectMapper.readValue(payload, SignalMessage.class);

        String type = signalMessage.getType();

        if ("JOIN_ROOM".equals(type)) {
            handleJoinRoom(session, signalMessage);
        } else if ("LEAVE_ROOM".equals(type)) {
            handleLeaveRoom(session, signalMessage);
        } else if ("LIST_USERS".equals(type)) {
            handleListUsers(session, signalMessage);
        } else if("WEBRTC_OFFER".equals(type) || "WEBRTC_ANSWER".equals(type) || "ICE_CANDIDATE".equals(type)) {
            forwardToTargetUser(session, payload, signalMessage);
        } else if("PRESENCE_UPDATE".equals(type)) {
            broadcastPresenceUpdate(payload, signalMessage);
        } else {
            session.sendMessage(new TextMessage("{\"type\":\"ERROR\",\"message\":\"Unknown message type\"}"));
        }
    }

    

    private void handleJoinRoom(WebSocketSession session, SignalMessage signalMessage) throws Exception {
        String username = signalMessage.getUserName();
        String room = signalMessage.getRoom();
        String previousRoom = roomByUsername.get(username);

        if (previousRoom != null && !previousRoom.equals(room)) {
            roomManager.leaveRoom(previousRoom, username);
            broadcastRoomUsers(previousRoom, roomManager.listUsers(previousRoom));
        }

        connectionManager.register(username, session);
        roomManager.joinRoom(room, username);
        roomByUsername.put(username, room);

        List<String> users = roomManager.listUsers(room);
        broadcastRoomUsers(room, users);

        System.out.println(username + " joined room " + room);
        System.out.println("Current users in room " + room + ": " + users);
    }

    private void handleLeaveRoom(WebSocketSession session, SignalMessage signalMessage) throws Exception {
        String username = signalMessage.getUserName();
        String room = signalMessage.getRoom();

        roomManager.leaveRoom(room, username);
        roomByUsername.remove(username, room);

        List<String> users = roomManager.listUsers(room);
        broadcastRoomUsers(room, users);

        System.out.println(username + " left room " + room);
        System.out.println("Current users in room " + room + ": " + users);
    }

    private void handleListUsers(WebSocketSession session, SignalMessage signalMessage) throws Exception {
        String room = signalMessage.getRoom();

        List<String> users = roomManager.listUsers(room);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(users)));

        System.out.println("Current users in room " + room + ": " + users);
    }

    private void broadcastRoomUsers(String room, List<String> users) throws Exception {
        String usersPayload = objectMapper.writeValueAsString(users);

        for (String username : users) {
            WebSocketSession userSession = connectionManager.getSession(username);
            if (userSession != null && userSession.isOpen()) {
                userSession.sendMessage(new TextMessage(usersPayload));
            }
        }
    }

    private void forwardToTargetUser(WebSocketSession senderSession, String rawPayload, SignalMessage signalMessage) throws Exception {
        String targetUsername = signalMessage.getTo();
        WebSocketSession localTargetSession = connectionManager.getSession(targetUsername);

        if (localTargetSession != null && localTargetSession.isOpen()) {
            localTargetSession.sendMessage(new TextMessage(rawPayload));
            System.out.println("Locally Forwarded " + signalMessage.getType() + " from " + signalMessage.getFrom() + " to " + signalMessage.getTo());
            return;
        } 

        redisMessagePublisher.publish(signalingTopic.getTopic(), rawPayload);

        System.out.println(
            "Published " + signalMessage.getType() + " to Redis for target " + targetUsername
        );
    }

    private void broadcastPresenceUpdate(String rawPayload, SignalMessage signalMessage) throws Exception {
        String room = signalMessage.getRoom();
        String sender = signalMessage.getUserName();

        List<String> usersInRoom = roomManager.listUsers(room);

        redisPresenceService.updatePresence(sender, room, Boolean.TRUE.equals(signalMessage.getMuted()), Boolean.TRUE.equals(signalMessage.getDeafened()), Boolean.TRUE.equals(signalMessage.getSpeaking()));

        for (String username : usersInRoom) {
            if(username.equals(sender)) {
                continue; // Skip sending to the sender
            }
            WebSocketSession userSession = connectionManager.getSession(username);
            if (userSession != null && userSession.isOpen()) {
                userSession.sendMessage(new TextMessage(rawPayload));
            }
        }
    

        System.out.println("Broadcasted presence update from" + sender + " in room " + room);
    }

    

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = connectionManager.getUsernameBySessionId(session.getId());
        if (username != null) {
            String room = roomByUsername.remove(username);
            if (room != null) {
                try {
                    roomManager.leaveRoom(room, username);
                    broadcastRoomUsers(room, roomManager.listUsers(room));
                } catch (Exception exception) {
                    exception.printStackTrace();
                }
            }
            redisPresenceService.markOffline(username);
        }
        connectionManager.remove(session);
        System.out.println("Client disconnected: " + session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        System.err.println("WebSocket error for session " + session.getId());
        exception.printStackTrace();

    }
}
