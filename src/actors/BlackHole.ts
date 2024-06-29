import { Actor, Color, Engine } from "excalibur";

export class BlackHole extends Actor {
    constructor() {
        super({
            radius: 100,
            color: Color.Yellow,
        });
    }

    onInitialize(engine: Engine): void {
        const material = (this.graphics.material = engine.graphicsContext.createMaterial({
            name: "bh-mat",
            fragmentSource: bgFragment,
        }));

        const camera = engine.currentScene.camera;
        let oldZoom = camera.zoom;

        material.update((shader) => {
            shader.trySetUniformFloat("u_zoom", camera.zoom);
        });

        this.on("postupdate", () => {
            this.pos = engine.screenToWorldCoordinates(engine.input.pointers.primary.lastScreenPos);

            if (Math.abs(camera.zoom - oldZoom) > 0.01) {
                oldZoom = camera.zoom;

                material.update((shader) => {
                    shader.trySetUniformFloat('u_zoom', camera.zoom)
                });
            }
        });
    }
}

const bgFragment = `
#version 300 es

precision mediump float;

uniform float u_time_ms;

uniform vec2 u_resolution;
uniform vec2 u_graphic_resolution;

uniform sampler2D u_graphic;
uniform sampler2D u_screen_texture;

uniform vec2 u_size;

uniform float u_zoom;

in vec2 v_uv;
in vec2 v_screenuv;

out vec4 fragColor;

vec2 normalizePos() {
    float aspect = u_resolution.y / u_resolution.x;
    float scale = 0.078;   // u_zoom * 0.05;   // 0.078;

    vec2 v2 = v_screenuv + v_uv * 0.15;
    v2.y = -v2.y;

    return v2;
}

vec2 warpPos(vec2 pos) {
    vec2 localCenter = v_uv - vec2(0.5);
    localCenter.y = -localCenter.y;

    float distance = length(localCenter);
    // float factor = max(0.0, .7 - pow(abs(distance), 0.5));
    float factor = max(0.0, .6 - pow(abs(sin(3.14 * distance / 2.)), 1.5));
    vec2 warpedPos = pos - (localCenter * factor);

    return warpedPos;
}

float holeBlend() {
    vec2 localCenter = v_uv - vec2(0.5);
    localCenter.y = -localCenter.y;

    float distance = length(localCenter);

    return 1.0 - pow(max(0.0, abs(distance / 0.3) * 2.0 - 1.0), 2.0);
}

void main() {
    vec2 pos = normalizePos();
    vec2 warpedPos = warpPos(pos);

    vec4 t = texture(u_screen_texture, warpedPos);
    // fragColor = mix(t, vec4(1., 0., 0., 1.0), 0.2);

    // vec4 dark = vec4(0.1, 0.1, 0.1, 1.);
    // fragColor = mix(t, dark, holeBlend());

    fragColor = t;
}
`.trim();
