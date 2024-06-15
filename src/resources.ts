import { Animation, ImageSource, Loader, SpriteSheet, range } from "excalibur";
import asteroid from "./images/asteroid.png";
import bullet from "./images/bullet.png";
import logo from "./images/logo.png";
import player from "./images/player.png";
import space from "./images/space.png";
import sword from "./images/sword.png";

export const Resources = {
    Sword: new ImageSource(sword),
    Player: new ImageSource(player),
    Asteroid: new ImageSource(asteroid),
    Space: new ImageSource(space),
    Bullet: new ImageSource(bullet),
} as const;

export const Animations = {
    get Bullet() {
        const blinkSheet = SpriteSheet.fromImageSource({
            image: Resources.Bullet,
            grid: {
                rows: 1,
                columns: 2,
                spriteWidth: 8,
                spriteHeight: 6,
            },
        });

        return Animation.fromSpriteSheet(blinkSheet, range(0, 1), 250);
    },
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
