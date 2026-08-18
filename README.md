# Niri Scrollbar 🖱️

> **Disclaimer:** This project is an experimental implementation made entirely with AI by an unexperienced programmer. Use with caution.

A gesture-driven scrollbar widget designed for the [Niri](https://github.com/YaLTeR/niri) Wayland compositor. This project combines a low-level Python daemon with a TypeScript-based UI to provide high-fidelity, gesture-based scrolling.

## ✨ Features

- **Nix Native**: Managed via Nix Flakes for reproducible installation and easy integration.
- **Virtual Input**: Uses `evdev` to create a `virtual-touchpad` device, allowing for high-precision multi-touch gesture emulation.
- **High Performance**: Communicates via a local Unix socket (`/tmp/niri-scroll.sock`) using a lightweight JSON protocol.
- **Seamless Integration**: Designed to work within the Niri compositor workflow.

## 🏗️ Architecture

This service creates a screenwide, short and invisible scrollbar along the top of your monitor, just click, hold and drag

The project consists of two primary layers:

### 1. Backend Daemon (`niri-scroll-daemon.py`)
A Python-based service that manages the hardware-level interaction.
- **Input Emulation**: Creates a virtual input device capable of handling `BTN_TOUCH` and multi-finger `ABS_MT` events.
- **Communication**: Runs a socket server that listens for JSON-encoded commands.

### 2. Frontend UI (`niri-scrollbar.ts` & `main.ts`)
A TypeScript implementation that provides the visual interface.
- Communicates with the Python daemon via the Unix socket.
- Translates user interactions into movement deltas sent to the backend.

## 🚀 Installation

This project is a **Nix Flake**.

### 1. Add the Input
Add this repository to your `flake.nix`:

```nix
inputs.niri-scrollbar.url = "github:MaveDX/Niri-Scrollbar";
```

### 2. Enable the Service (Home Manager)
In your Home Manager configuration (e.g., `home.nix`), import the module and enable the service. **Note:** This module automatically handles the necessary `udev` rules to grant your user permission to access `/dev/uinput`.

```nix
{
  imports = [
    niri-scrollbar.homeManagerModules.default
  ];

  services.niriScrollbar.enable = true;
}
```

### 3. Apply Changes
Rebuild your configuration:

```bash
home-manager switch
```

## ⚙️ Requirements & Permissions

### Virtual Input (`/dev/uinput`)
The daemon requires permission to create a virtual input device. 
- **Automatic**: If you use the `services.niriScrollbar.enable` option, the provided Nix module automatically installs the required `udev` rules.
- **Manual**: If you are running the daemon outside of Nix, you must ensure your user is part of the `input` group or has a udev rule allowing access to `/dev/uinput`.

### Systemd Lifecycle
The services are configured to run under the `graphical-session.target`. They will start automatically when you log into a Niri session and shut down when you exit.

## 📂 Project Structure

- `flake.nix`: The Nix Flake entry point.
- `niri-scroll-daemon.py`: The Python backend daemon.
- `niri-scrollbar.ts`: The core TypeScript UI logic.
- `main.ts`: The UI entry point.
- `scrollbar.nix`: Nix configuration for system integration.

## 📄 License

Distributed under the MIT License.
