package com.example.EchoLink.redis;

import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.example.EchoLink.websocket.ConnectionManager;
import com.example.EchoLink.websocket.SignalMessage;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class RedisSubscriber implements MessageListener{
    private final ConnectionManager connectionManager;
    private final ObjectMapper objectMapper;

    public RedisSubscriber(ConnectionManager connectionManager){
        this.connectionManager = connectionManager;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public void onMessage(Message message, byte[] pattern){
        try {
            String payload = new String(message.getBody());
            SignalMessage signalMessage = objectMapper.readValue(payload, SignalMessage.class);

            String targetUsername = signalMessage.getTo();
            if(targetUsername == null){
                return;
            }
            WebSocketSession targetSession = connectionManager.getSession(targetUsername);

            if(targetSession!=null && targetSession.isOpen()){
                targetSession.sendMessage((new TextMessage(payload)));

                System.out.println("Redis delivered" + signalMessage.getType() + "to" + targetUsername);
            }
        }catch(Exception exception){
            exception.printStackTrace();
        }
    }
}
