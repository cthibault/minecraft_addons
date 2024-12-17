import { Vector3 } from "@minecraft/server"

export class Vector3Wrapper implements Vector3 {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static createFrom(v: Vector3): Vector3Wrapper {
        return new Vector3Wrapper(v.x, v.y, v.z);
    }

    add(v: Vector3) {
        return new Vector3Wrapper(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    subtract(v: Vector3) {
        return new Vector3Wrapper(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    multiply(scalar) {
        return new Vector3Wrapper(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    normalize() {
        const magnitude = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
        return new Vector3Wrapper(this.x / magnitude, this.y / magnitude, this.z / magnitude);
    }

    toString(): string {
        return `(${this.x}, ${this.y}, ${this.z})`
    }
}