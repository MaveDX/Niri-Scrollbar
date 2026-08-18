{
  description = "Niri Scrollbar Widget Flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    # You can also add other inputs here (like niri or python dependencies)
  };

  outputs = { self, nixpkgs, home-manager, ... }: {
    # This is the "Magic" part for users
    homeManagerModules = {
      default = ./scrollbar.nix;
    };

    # You should also provide the packages via the flake
    packages.x86_64-linux = {
      default = nixpkgs.legacyPackages.x86_64-linux.writeShellScriptBin "niri-scrollbar-test" ''
        echo "Testing niri-scrollbar..."
      '';
    };
  };
}
