package com.example.EchoLink.websocket;
import com.fasterxml.jackson.databind.JsonNode;

public class SignalMessage {
    
    private String type;
    private String room;
    private String userName;

    private String from;
    private String to;

    private String sdp;
    private JsonNode candidate;

    private Boolean muted;
    private Boolean deafened;
    private Boolean speaking;

    public SignalMessage() {
    }

    // Getters and setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getRoom() {
        return room;
    }

    public void setRoom(String room) {
        this.room = room;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public String getSdp() {
        return sdp;
    }

    public void setSdp(String sdp) {
        this.sdp = sdp;
    }

    public JsonNode getCandidate() {
        return candidate;
    }

    public void setCandidate(JsonNode candidate) {
        this.candidate = candidate;
    }

    public Boolean getMuted() {
        return muted;
    }

    public void setMuted(Boolean muted) {
        this.muted = muted;
    }

    public Boolean getDeafened() {
        return deafened;
    }

    public void setDeafened(Boolean deafened) {
        this.deafened = deafened;
    }

    public Boolean getSpeaking() {
        return speaking;
    }

    public void setSpeaking(Boolean speaking) {
        this.speaking = speaking;
    }

}
