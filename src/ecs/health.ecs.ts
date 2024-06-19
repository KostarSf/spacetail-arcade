import {
    Actor,
    Component,
    Entity,
    EventEmitter,
    GameEvent,
    Query,
    Scene,
    System,
    SystemPriority,
    SystemType,
    TransformComponent,
    Vector,
    World,
} from "excalibur";
import { HitLabel } from "~/entities/HitLabel";

export interface HealthComponentOptions {
    health: number;
    maxHealth?: number;
    labelsVisible?: boolean;
    labelsAnchor?: Vector;
}

export class HealthComponent extends Component {
    public events = new EventEmitter<{
        heal: HealEvent<HealthComponent>;
        damage: DamageEvent<HealthComponent>;
        death: DeathEvent<HealthComponent>;
    }>();

    private _health: number;
    private _maxHealth: number;

    public _oldHealth: number;
    public _lastSource?: Actor;

    get health() {
        return this._health;
    }

    set health(value: number) {
        this._health = Math.min(value, this._maxHealth);
    }

    changeHealth(amount: number, source?: Actor) {
        this.health += amount;

        if (source) {
            this._lastSource = source;
        }
    }

    get healthDelta() {
        return this.health - this._oldHealth;
    }

    get maxHealth() {
        return this._maxHealth;
    }

    set maxHealth(value: number) {
        this._maxHealth = value;
        this.health = this.health;
    }

    get isDead() {
        return this.health <= 0;
    }

    public labelsVisible: boolean;
    public labelsAnchor: Vector;

    readonly dependencies = [TransformComponent];

    constructor(options: HealthComponentOptions) {
        super();

        this._health = options.health;
        this._maxHealth = options.maxHealth ?? options.health;
        this._oldHealth = this._health;
        this.labelsVisible = options.labelsVisible ?? true;
        this.labelsAnchor = options.labelsAnchor ?? Vector.Zero;
    }

    onAdd(owner: Entity<any>): void {
        this.events.on("damage", (evt) => {
            owner.events.emit(
                "damage",
                new DamageEvent(evt.target.owner!, evt.amount, evt.damager)
            );
        });
        this.events.on("heal", (evt) => {
            owner.events.emit("heal", new HealEvent(evt.target.owner!, evt.amount, evt.healer));
        });
        this.events.on("death", (evt) => {
            owner.events.emit("death", new DeathEvent(evt.target.owner!, evt.damager));
        });
    }

    onRemove(): void {
        this.events.clear();
    }
}

export class DamageEvent<T extends HealthComponent | Entity = Actor> extends GameEvent<T> {
    constructor(target: T, public amount: number, public damager?: Actor) {
        super();
        this.target = target;
    }
}

export class HealEvent<T extends HealthComponent | Entity = Actor> extends GameEvent<T> {
    constructor(target: T, public amount: number, public healer?: Actor) {
        super();
        this.target = target;
    }
}

export class DeathEvent<T extends HealthComponent | Entity = Actor> extends GameEvent<T> {
    constructor(target: T, public damager?: Actor) {
        super();
        this.target = target;
    }
}

export class HealthSystem extends System {
    public systemType: SystemType = SystemType.Update;
    public priority: number = SystemPriority.Average;

    private query: Query<typeof HealthComponent | typeof TransformComponent>;
    private scene!: Scene;

    constructor(world: World) {
        super();
        this.query = world.query([HealthComponent]);
    }

    initialize(_world: World, scene: Scene<unknown>): void {
        this.scene = scene;
    }

    update(_elapsedMs: number): void {
        let health: HealthComponent;

        const entities = this.query.entities;
        for (let i = 0; i < entities.length; i++) {
            health = entities[i].get(HealthComponent);

            const delta = health.healthDelta;

            if (delta < 0) {
                health.events.emit(
                    "damage",
                    new DamageEvent(health, -health.healthDelta, health._lastSource)
                );
            }

            if (delta > 0) {
                health.events.emit(
                    "heal",
                    new HealEvent(health, health.healthDelta, health._lastSource)
                );
            }

            if (delta !== 0 && health.labelsVisible && !entities[i].isKilled()) {
                this.scene.add(
                    new HitLabel({
                        pos: entities[i].get(TransformComponent).pos.add(health.labelsAnchor),
                        value: health.healthDelta,
                    })
                );
            }

            if (health.isDead) {
                health.events.emit("death", new DeathEvent(health, health._lastSource));
            }

            health._oldHealth = health.health;
        }
    }
}
