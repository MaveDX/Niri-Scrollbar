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

in

{

# Define the option

options.services.niriScrollbar = {

enable = lib.mkOption {

type = lib.types.bool;

default = false;

description = "Enable the Niri Scrollbar daemon and UI services.";

};

};

# Only enable services if the option is true

config = lib.mkIf config.services.niriScrollbar.enable {

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

};

}