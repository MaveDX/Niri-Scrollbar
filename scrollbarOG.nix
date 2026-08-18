{ config, pkgs, lib, ... }:

let
  # 1. Package the Python Daemon
  scrollDaemon = pkgs.writers.writePython3Bin "niri-scroll-daemon" {
    libraries = [ pkgs.python3Packages.evdev ]; 
    flakeIgnore = [ "E" "F" "W" ]; # Ignores all flake8 formatting/syntax warnings
  } (builtins.readFile ./niri-scroll-daemon.py);

  # 2. Package the Astal TypeScript Files
  scrollbarUI = pkgs.stdenv.mkDerivation {
    name = "niri-scrollbar-ui";
    src = ./.; 
    
    installPhase = ''
      mkdir -p $out/share/niri-scrollbar
      cp main.ts niri-scrollbar.ts $out/share/niri-scrollbar/
    '';
  };

# ... rest of the file remains unchanged

in {
  # 3. Define Systemd User Services
  
  systemd.user.services.niri-scroll-daemon = {
    Unit = {
      Description = "Niri Scrollbar Socket Daemon";
      PartOf = [ "graphical-session.target" ];
    };
    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
    Service = {
      # This now executes the standalone, evdev-bundled Python binary directly
      ExecStart = "${scrollDaemon}/bin/niri-scroll-daemon";
      Restart = "always";
      RestartSec = "3";
    };
  };

  systemd.user.services.niri-scrollbar-ui = {
    Unit = {
      Description = "Niri Scrollbar Astal UI";
      Requires = [ "niri-scroll-daemon.service" ];
      After = [ "niri-scroll-daemon.service" "graphical-session.target" ];
      PartOf = [ "graphical-session.target" ];
    };
    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
    Service = {
      ExecStart = "${pkgs.ags}/bin/ags run ${scrollbarUI}/share/niri-scrollbar/main.ts";
      Restart = "on-failure";
      RestartSec = "3";
    };
  };
}
