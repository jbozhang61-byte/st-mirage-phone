package com.mirage.phone;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * APK 内置的 WebSocket 中继：ws://127.0.0.1:17650
 * 酒馆的桥接插件和手机界面都连这里，互相转发消息。
 */
public class LocalRelay {
    public static final int PORT = 17650;
    private static final String GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    private static final List<Client> CLIENTS = new CopyOnWriteArrayList<>();
    private static ServerSocket server;
    private static volatile boolean running = false;

    public static void start() {
        if (running) return;
        running = true;
        new Thread(() -> {
            try {
                server = new ServerSocket(PORT, 8, InetAddress.getByName("127.0.0.1"));
                while (running) {
                    Socket socket = server.accept();
                    Client client = new Client(socket);
                    if (client.handshake()) {
                        CLIENTS.add(client);
                        new Thread(client).start();
                    } else {
                        try { socket.close(); } catch (IOException ignored) { }
                    }
                }
            } catch (Throwable ignored) { }
        }, "local-relay").start();
    }

    public static volatile String lastState = null;
    public static volatile Runnable onState = null;

    public static boolean isRunning() { return running; }
    public static int clientCount() { return CLIENTS.size(); }

    static void broadcast(String text, Client from) {
        for (Client client : CLIENTS) {
            if (client != from) client.send(text);
        }
    }

    static class Client implements Runnable {
        private final Socket socket;
        private InputStream in;
        private OutputStream out;

        Client(Socket socket) { this.socket = socket; }

        boolean handshake() {
            try {
                in = socket.getInputStream();
                out = socket.getOutputStream();
                StringBuilder header = new StringBuilder();
                int b;
                while ((b = in.read()) != -1) {
                    header.append((char) b);
                    if (header.length() >= 4 && header.substring(header.length() - 4).equals("\r\n\r\n")) break;
                }
                String key = null;
                for (String line : header.toString().split("\r\n")) {
                    if (line.toLowerCase().startsWith("sec-websocket-key:")) {
                        key = line.substring(line.indexOf(':') + 1).trim();
                    }
                }
                if (key == null) return false;
                String accept = Base64.getEncoder().encodeToString(
                        MessageDigest.getInstance("SHA-1").digest((key + GUID).getBytes(StandardCharsets.UTF_8)));
                String response = "HTTP/1.1 101 Switching Protocols\r\n"
                        + "Upgrade: websocket\r\n"
                        + "Connection: Upgrade\r\n"
                        + "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";
                out.write(response.getBytes(StandardCharsets.US_ASCII));
                out.flush();
                return true;
            } catch (Throwable error) {
                return false;
            }
        }

        @Override
        public void run() {
            try {
                while (true) {
                    int first = in.read();
                    if (first < 0) break;
                    int opcode = first & 0x0F;
                    int second = in.read();
                    if (second < 0) break;
                    boolean masked = (second & 0x80) != 0;
                    long length = second & 0x7F;
                    if (length == 126) {
                        length = ((in.read() & 0xFF) << 8) | (in.read() & 0xFF);
                    } else if (length == 127) {
                        for (int i = 0; i < 8; i++) in.read();
                        break;
                    }
                    byte[] mask = new byte[4];
                    if (masked) {
                        for (int i = 0; i < 4; i++) mask[i] = (byte) in.read();
                    }
                    byte[] payload = new byte[(int) length];
                    int read = 0;
                    while (read < payload.length) {
                        int n = in.read(payload, read, payload.length - read);
                        if (n < 0) break;
                        read += n;
                    }
                    if (masked) {
                        for (int i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
                    }
                    if (opcode == 8) break;
                    if (opcode == 9) { sendFrame(payload, 10); continue; }
                    if (opcode == 1 || opcode == 2) {
                        String text = new String(payload, StandardCharsets.UTF_8);
                        broadcast(text, this);
                        if (text.contains("\"type\":\"state\"") || text.contains("\"type\": \"state\"")) {
                            lastState = text;
                            Runnable callback = onState;
                            if (callback != null) callback.run();
                        }
                    }
                }
            } catch (Throwable ignored) { }
            CLIENTS.remove(this);
            try { socket.close(); } catch (IOException ignored) { }
        }

        void send(String text) { sendFrame(text.getBytes(StandardCharsets.UTF_8), 1); }

        synchronized void sendFrame(byte[] payload, int opcode) {
            try {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                buffer.write(0x80 | opcode);
                if (payload.length < 126) {
                    buffer.write(payload.length);
                } else if (payload.length < 65536) {
                    buffer.write(126);
                    buffer.write((payload.length >> 8) & 0xFF);
                    buffer.write(payload.length & 0xFF);
                } else {
                    buffer.write(127);
                    for (int i = 7; i >= 0; i--) buffer.write((int) (((long) payload.length >> (8 * i)) & 0xFF));
                }
                buffer.write(payload);
                out.write(buffer.toByteArray());
                out.flush();
            } catch (Throwable ignored) { }
        }
    }
}
