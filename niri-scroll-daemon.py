#!/usr/bin/env python3
import os
import socket
import time
import threading
import json
from evdev import UInput, AbsInfo, ecodes as e

# --- Virtual touchpad setup ---

cap = {
    e.EV_KEY: [
        e.BTN_LEFT,
        e.BTN_TOUCH,
        e.BTN_TOOL_FINGER,
        e.BTN_TOOL_DOUBLETAP,
        e.BTN_TOOL_TRIPLETAP,
    ],
    e.EV_ABS: [
        (e.ABS_X,              AbsInfo(0, 0, 20000, 0, 0, 0)),
        (e.ABS_Y,              AbsInfo(0, 0, 2000, 0, 0, 0)),
        (e.ABS_MT_SLOT,        AbsInfo(0, 0, 4, 0, 0, 0)),
        (e.ABS_MT_TRACKING_ID, AbsInfo(-1, -1, 65535, 0, 0, 0)),
        (e.ABS_MT_POSITION_X,  AbsInfo(0, 0, 20000, 0, 0, 0)),
        (e.ABS_MT_POSITION_Y,  AbsInfo(0, 0, 2000, 0, 0, 0)),
    ],
    e.EV_SYN: [],
}

ui = UInput(cap, name="virtual-touchpad", input_props=[e.INPUT_PROP_POINTER, e.INPUT_PROP_BUTTONPAD])
time.sleep(1)  # wait for libinput to register

SOCK_PATH = "/tmp/niri-scroll.sock"

# --- Gesture state ---
# Fingers start at these X positions, move with delta
BASE_X = [9000, 10000, 11000]
BASE_Y = 1000
finger_x = list(BASE_X)
gesture_active = False
lock = threading.Lock()

def fingers_down():
    global finger_x, gesture_active
    finger_x = list(BASE_X)
    for slot, (x, tid) in enumerate(zip(finger_x, [10, 11, 12])):
        ui.write(e.EV_ABS, e.ABS_MT_SLOT, slot)
        ui.write(e.EV_ABS, e.ABS_MT_TRACKING_ID, tid)
        ui.write(e.EV_ABS, e.ABS_MT_POSITION_X, x)
        ui.write(e.EV_ABS, e.ABS_MT_POSITION_Y, BASE_Y)
    ui.write(e.EV_KEY, e.BTN_TOUCH, 1)
    ui.write(e.EV_KEY, e.BTN_TOOL_TRIPLETAP, 1)
    ui.write(e.EV_ABS, e.ABS_X, finger_x[1])
    ui.write(e.EV_ABS, e.ABS_Y, BASE_Y)
    ui.syn()
    gesture_active = True

def fingers_move(dx):
    global finger_x

    finger_x = [x + dx for x in finger_x]

    if max(finger_x) > 18000 or min(finger_x) < 2000:
        finger_x = list(BASE_X)

    for slot, x in enumerate(finger_x):
        ui.write(e.EV_ABS, e.ABS_MT_SLOT, slot)
        ui.write(e.EV_ABS, e.ABS_MT_POSITION_X, x)
        ui.write(e.EV_ABS, e.ABS_MT_POSITION_Y, BASE_Y)

    ui.write(e.EV_ABS, e.ABS_X, finger_x[1])
    ui.syn()

def fingers_up():
    global gesture_active
    for slot in range(3):
        ui.write(e.EV_ABS, e.ABS_MT_SLOT, slot)
        ui.write(e.EV_ABS, e.ABS_MT_TRACKING_ID, -1)
    ui.write(e.EV_KEY, e.BTN_TOUCH, 0)
    ui.write(e.EV_KEY, e.BTN_TOOL_TRIPLETAP, 0)
    ui.syn()
    gesture_active = False

# --- Socket server ---
# Protocol (newline-delimited JSON):
#   {"type": "begin"}           - start gesture
#   {"type": "update", "dx": N} - move by N pixels (positive = scroll right, negative = left)
#   {"type": "end"}             - end gesture

def handle_client(conn):
    global gesture_active
    with conn:
        buf = ""
        try:
            while True:
                data = conn.recv(256)
                if not data:
                    break
                buf += data.decode()
                while "\n" in buf:
                    line, buf = buf.split("\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        msg = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    with lock:
                        t = msg.get("type")
                        if t == "begin":
                            if not gesture_active:
                                fingers_down()
                        elif t == "update":
                            if gesture_active:
                                dx = int(msg.get("dx", 0))
                                fingers_move(dx)
                        elif t == "end":
                            if gesture_active:
                                fingers_up()
        except Exception as ex:
            print(f"client error: {ex}")
        finally:
            with lock:
                if gesture_active:
                    fingers_up()

def main():
    if os.path.exists(SOCK_PATH):
        os.unlink(SOCK_PATH)

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(SOCK_PATH)
    os.chmod(SOCK_PATH, 0o600)
    server.listen(5)
    print(f"niri-scroll-daemon listening on {SOCK_PATH}")

    try:
        while True:
            conn, _ = server.accept()
            t = threading.Thread(target=handle_client, args=(conn,), daemon=True)
            t.start()
    except KeyboardInterrupt:
        print("shutting down")
    finally:
        with lock:
            if gesture_active:
                fingers_up()
        ui.close()
        server.close()
        if os.path.exists(SOCK_PATH):
            os.unlink(SOCK_PATH)

if __name__ == "__main__":
    main()
