export function lerp(
    value: number,
    min: number,
    max: number,
    interpolationFn: (value: number) => number = linear
) {
    const clampedValue = Math.max(min, Math.min(value, max));
    const normalizedValue = (clampedValue - min) / (max - min);
    return interpolationFn(normalizedValue);
}

export const linear = (t: number) => t;
export const easeIn = (t: number) => t * t;
export const easeOut = (t: number) => t * (2 - t);
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
