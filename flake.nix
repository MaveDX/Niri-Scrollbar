{
  description = "Niri Scrollbar Widget and Daemon";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      # 1. Package the Python Daemon (Bypasses linting)
      pythonEnv = pkgs.python3.withPackages (ps: [ ps.evdev ]);
      scrollDaemon = pkgs.writeScriptBin "niri-scroll-daemon" ''
        #!${pythonEnv}/bin/python3
        ${builtins.readFile ./niri-scroll-daemon.py}
      '';

      # 2. Package the Astal TypeScript Files
      scrollbarUI = pkgs.stdenv.mkDerivation {
        name = "niri-scrollbar-ui";
        src = ./.;
        installPhase = ''
          mkdir -p $out/share/niri-scrollbar
          cp main.ts niri-scrollbar.ts $out/share/niri-scrollbar/
        '';
      };

    in {
      # This is what executes when you type `nix build`
      packages.${system} = {
        default = pkgs.symlinkJoin {
          name = "niri-scrollbar-full";
          paths = [ scrollDaemon scrollbarUI ];
        };
        daemon = scrollDaemon;
        ui = scrollbarUI;
      };

      # This is the module you will import into your main Home Manager config
      homeManagerModules.default = { config, lib, pkgs, ... }: {
        systemd.user.services.niri-scroll-daemon = {
          Unit = {
            Description = "Niri Scrollbar Socket Daemon";
            PartOf = [ "graphical-session.target" ];
          };
          Install = { WantedBy = [ "graphical-session.target" ]; };
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
          Install = { WantedBy = [ "graphical-session.target" ]; };
          Service = {
            ExecStart = "${pkgs.ags}/bin/ags run ${scrollbarUI}/share/niri-scrollbar/main.ts";
            Restart = "on-failure";
            RestartSec = "3";
          };
        };
      };
    };
}
