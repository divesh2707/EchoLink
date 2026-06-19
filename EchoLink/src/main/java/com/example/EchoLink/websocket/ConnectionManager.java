package com.example.EchoLink.websocket;
import org.springframework.web.socket.WebSocketSession;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class ConnectionManager {
    
    private final Map<String, WebSocketSession> sessionsByUsername = new ConcurrentHashMap<>();
    private final Map<String, String> usernameBySessionId = new ConcurrentHashMap<>();

    public void register(String username, WebSocketSession session) {
        sessionsByUsername.put(username, session);
        usernameBySessionId.put(session.getId(), username);
    }

    public String getUsernameBySessionId(String sessionId) {
        return usernameBySessionId.get(sessionId);
    }

    public WebSocketSession getSession(String username) {
        return sessionsByUsername.get(username);
    }

    public Map<String, WebSocketSession> getAllSessions() {
        return sessionsByUsername;
    }

    public void remove(WebSocketSession session) {
        String username = usernameBySessionId.remove(session.getId());
        if (username != null) {
            sessionsByUsername.remove(username);
        }
    }
}
