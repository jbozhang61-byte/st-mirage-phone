"""
幻镜手机 · 本机中转（Python 版）
Termux 用法：
  pkg install python -y
  pip install websockets -i https://pypi.tuna.tsinghua.edu.cn/simple
  python relay.py

酒馆插件和手机 App 都连 ws://127.0.0.1:17650，互相转发。
"""
import asyncio
import json

try:
    import websockets
except ImportError:
    raise SystemExit("先装依赖：pip install websockets -i https://pypi.tuna.tsinghua.edu.cn/simple")

PORT = 17650
CLIENTS = set()


async def handler(ws):
    CLIENTS.add(ws)
    role = "unknown"
    try:
        async for raw in ws:
            try:
                data = json.loads(raw)
            except Exception:
                continue
            if not isinstance(data, dict):
                continue
            if data.get("type") == "hello":
                role = "app" if data.get("role") == "app" else "tavern"
                print("[relay] " + role + " 已连接", flush=True)
                continue
            if data.get("type") == "command" and data.get("action") == "send":
                print("[relay] 收到手机消息：" + str(data.get("text", ""))[:40], flush=True)
            dead = []
            for client in CLIENTS:
                if client is ws:
                    continue
                try:
                    await client.send(raw)
                except Exception:
                    dead.append(client)
            for client in dead:
                CLIENTS.discard(client)
    finally:
        CLIENTS.discard(ws)
        print("[relay] " + role + " 断开", flush=True)


async def main():
    async with websockets.serve(handler, "127.0.0.1", PORT):
        print("[幻镜手机] 本机中转已启动 ws://127.0.0.1:" + str(PORT), flush=True)
        print("[幻镜手机] 酒馆插件和手机 App 都连这个地址", flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
