# Running Niri Scrollbar on Non-NixOS Distributions 🐧

If you are not using NixOS or Nix Flakes, you can still run this project manually. This guide covers setting up the necessary permissions, Python dependencies, and the TypeScript frontend.

## 📋 Prerequisites

Before starting, ensure you have the following installed on your system:

- **Python 3**
- **Python `evdev` library**
- **Node.js & npm** (for the TypeScript UI)
- **A Wayland compositor** (specifically [Niri](https://github.com/YaLTeR/niri))

---

## 🛠️ Step 1: Hardware Permissions (Crucial)

The Python daemon creates a virtual input device using `/dev/uinput`. By default, most Linux distributions restrict access to this file for security reasons.

### Option A: The Permanent Way (Recommended)
Create a `udev` rule to allow the `input` group to access `uinput`.

1. Create a new rule file:
   ```bash
   sudo nano /etc/udev/rules.d/99-uinput.rules
   ```
2. Paste the following line into the file:
   ```text
   KERNEL=="uinput", GROUP="input", MODE="0660"
   ```
3. Save and exit.
4. Add your user to the `input` group:
   ```bash
   sudo usermod -aG input $USER
   ```
5. **Reboot your computer** (or log out and back in) for the group changes to take effect.

### Option B: The Quick/Temporary Way (For Testing Only)
If you just want to see if it works immediately without rebooting:
```bash
sudo chmod 666 /dev/uinput
```
*Note: This setting will disappear when you reboot.*

---

## 🐍 Step 2: Setting up the Python Daemon

1. Navigate to the project directory.
2. Install the `evdev` dependency:
   ```bash
   pip install evdev
   ```
3. Test the daemon:
   ```bash
   python niri-scroll-daemon.py
   ```
   *If you don't see permission errors, your udev rules are working!*

---

## 🟦 Step 3: Setting up the TypeScript UI

1. Open a new terminal window.
2. Install the Node dependencies:
   ```bash
   npm install
   ```
3. Run the UI:
   ```bash
   npm start
   ```
   *(Note: Depending on your setup, you may need to use `npx ts-node main.ts` if there is no start script defined in `package.json`.)*

---

## ⚙️ Running as a Background Service (Systemd)

To avoid running two terminals every time you boot, you can create a user-level `systemd` service.

### 1. Create the Daemon Service
Create `~/.config/systemd/user/niri-scroll-daemon.service`:
```ini
[Unit]
Description=Niri Scrollbar Python Daemon
After=graphical-session.target

[Service]
ExecStart=/usr/bin/python /path/to/your/niri-scroll-daemon.py
Restart=always

[Install]
WantedBy=graphical-session.target
```

### 2. Create the UI Service
Create `~/.config/systemd/user/niri-scrollbar-ui.service`:
```ini
[Unit]
Description=Niri Scrollbar TypeScript UI
After=niri-scroll-daemon.service

[Service]
ExecStart=/usr/bin/npm start --prefix /path/to/your/project
Restart=always

[Install]
WantedBy=graphical-session.target
```

### 3. Enable and Start
```bash
systemctl --user daemon-reload
systemctl --user enable --now niri-scroll-daemon.service niri-scrollbar-ui.service
```

## 🔍 Troubleshooting

- **"Permission Denied" on /dev/uinput**: Your `udev` rules aren't active. Ensure you are in the `input` group and have rebooted.
- **"Connection Refused" on Socket**: The Python daemon isn't running or failed to create the socket at `/tmp/niri-scroll.sock`. Check the daemon logs.
- **UI not appearing**: Ensure the Python daemon is running *before* you start the UI.
