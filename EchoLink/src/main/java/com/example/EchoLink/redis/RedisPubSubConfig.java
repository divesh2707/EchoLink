package com.example.EchoLink.redis;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
public class RedisPubSubConfig {

    @Bean
    public ChannelTopic signalingTopic() {
        return new ChannelTopic("echolink:signaling");
    }

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer
  (
        RedisConnectionFactory connectionFactory,
        RedisSubscriber redisSubscriber,
        ChannelTopic signalingTopic
   ) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(redisSubscriber, signalingTopic);
        return container;
    }
}
