import { Animation, AnimationStrategy, ImageSource, Loader, SpriteSheet, range } from "excalibur";
import asteroidItem1 from "./images/asteroids/item-01.png";
import asteroidItem2 from "./images/asteroids/item-02.png";
import asteroidLarge1 from "./images/asteroids/large-01.png";
import asteroidLarge2 from "./images/asteroids/large-02.png";
import asteroidMedium1 from "./images/asteroids/medium-01.png";
import asteroidMedium2 from "./images/asteroids/medium-02.png";
import asteroidSmall1 from "./images/asteroids/small-01.png";
import asteroidSmall2 from "./images/asteroids/small-02.png";
import bullet from "./images/bullet.png";
import explosion from "./images/explosion.png";
import jetstream from "./images/jetstream.png";
import logo from "./images/logo.png";
import pirateDamaged from "./images/pirate-damaged.png";
import pirate from "./images/pirate.png";
import playerDamaged from "./images/player-damaged.png";
import player from "./images/player.png";
import space from "./images/space.png";

export const Resources = {
    Player: new ImageSource(player),
    PlayerDamaged: new ImageSource(playerDamaged),

    Pirate: new ImageSource(pirate),
    PirateDamaged: new ImageSource(pirateDamaged),

    AsteroidSmall1: new ImageSource(asteroidSmall1),
    AsteroidSmall2: new ImageSource(asteroidSmall2),
    AsteroidMedium1: new ImageSource(asteroidMedium1),
    AsteroidMedium2: new ImageSource(asteroidMedium2),
    AsteroidLarge1: new ImageSource(asteroidLarge1),
    AsteroidLarge2: new ImageSource(asteroidLarge2),
    AsteroidItem1: new ImageSource(asteroidItem1),
    AsteroidItem2: new ImageSource(asteroidItem2),
    Bullet: new ImageSource(bullet),

    Space: new ImageSource(space),

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
