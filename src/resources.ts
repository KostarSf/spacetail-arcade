import { Animation, AnimationStrategy, ImageSource, Loader, SpriteSheet, range } from "excalibur";
import asteroid from "./images/asteroid.png";
import bullet from "./images/bullet.png";
import explosion from "./images/explosion.png";
import jetstream from "./images/jet_stream.png";
import logo from "./images/logo.png";
import pirate from "./images/pirate.png";
import player from "./images/player.png";
import space from "./images/space.png";

export const Resources = {
    Player: new ImageSource(player),
    Pirate: new ImageSource(pirate),
    Asteroid: new ImageSource(asteroid),
    Space: new ImageSource(space),
    Bullet: new ImageSource(bullet),
    Explosion: new ImageSource(explosion),
    JetStream: new ImageSource(jetstream),
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
    get Explosion() {
        const explosionSheet = SpriteSheet.fromImageSource({
            image: Resources.Explosion,
            grid: {
                rows: 1,
                columns: 4,
                spriteWidth: 32,
                spriteHeight: 32,
            },
        });

        return Animation.fromSpriteSheet(explosionSheet, range(0, 3), 100, AnimationStrategy.End);
    },

    get JetStream() {
        const jetSheet = SpriteSheet.fromImageSource({
            image: Resources.JetStream,
            grid: {
                rows: 1,
                columns: 2,
                spriteWidth: 32,
                spriteHeight: 32,
            },
        });

        return Animation.fromSpriteSheet(jetSheet, range(0, 1), 150);
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
