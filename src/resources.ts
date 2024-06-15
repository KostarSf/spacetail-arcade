import { ImageSource, Loader } from "excalibur";
import sword from "./images/sword.png";
import player from "./images/player.png";
import logo from "./images/logo.png";
import asteroid from "./images/asteroid.png";
import space from "./images/space.png";

export const Resources = {
    Sword: new ImageSource(sword),
    Player: new ImageSource(player),
    Asteroid: new ImageSource(asteroid),
    Space: new ImageSource(space),
} as const;

export const loader = new Loader();
for (const res of Object.values(Resources)) {
    loader.addResource(res);
}

loader.backgroundColor = "#000";
loader.playButtonText = "Play";
loader.logo = logo;
loader.logoWidth = 256;
loader.logoHeight = 128;
loader.suppressPlayButton = true;
