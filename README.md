Warning this project is entirely AI slop but it works

Requires "uinput" kernel module

A gesture-driven scrollbar widget designed for the Niri Wayland compositor. This project combines a low-level Python daemon with a TypeScript-based UI to provide high-fidelity, gesture-based scrolling.
Features

    Nix Native: Managed via Nix Flakes for reproducible installation and easy integration.
    Virtual Input: Uses evdev to create a virtual-touchpad device, allowing for high-precision multi-touch gesture emulation.
    High Performance: Communicates via a local Unix socket (/tmp/niri-scroll.sock) using a lightweight JSON protocol.
    Seamless Integration: Designed to work within the Niri compositor workflow.

Architecture

The project consists of two primary layers:
1. Backend Daemon (niri-scroll-daemon.py)

A Python-based service that manages the hardware-level interaction.

    Input Emulation: Creates a virtual input device capable of handling BTN_TOUCH and multi-finger ABS_MT events.
    Communication: Runs a socket server that listens for JSON-encoded commands:

- {"type": "begin"}: Starts a gesture.

- {"type": "update", "dx": N}: Updates the scroll position by NN pixels.

- {"type": "end"}: Ends the gesture.
2. Frontend UI (niri-scrollbar.ts & main.ts)

A TypeScript implementation that provides the visual interface.

    Communicates with the Python daemon via the Unix socket.
    Translates user interactions into movement deltas sent to the backend.

Installation

This project is a Nix Flake.
Using as a Nix Input

Add this repository to your flake.nix:

inputs.niri-scrollbar.url = "github:your-username/niri-scrollbar";

Manual Development

To run the daemon manually for testing:
Project Structure

    flake.nix: The Nix Flake entry point.
    niri-scroll-daemon.py: The Python backend daemon.
    niri-scrollbar.ts: The core TypeScript UI logic.
    main.ts: The UI entry point.
    scrollbar.nix: Nix configuration for system integration.

License

Distributed under the MIT License.
