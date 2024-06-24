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
    World,
} from "excalibur";
import { StatsChangeAction } from "~/network/events/actions/StatsChangeAction";
import { NetActor } from "~/network/NetActor";
import { NetStateComponent } from "~/network/NetStateComponent";

export class DamageEvent<T extends StatsComponentOptions | Entity = Actor> extends GameEvent<T> {
    constructor(
        target: T,
        public amount: number,
        public consumed: number,
        public direction: number | null
    ) {
        super();
        this.target = target;
    }
}

export interface StatsComponentOptions {
    healthDamageLabel?: boolean;

    health: number;
    maxHealth?: number;
    healthRecoverySpeed?: number;

    power: number;
    maxPower?: number;
    powerRecoverySpeed?: number;

    hardness?: number;

    healthResistance?: number;
    armorResistance?: number;
}

export class StatsComponent extends Component {
    public events = new EventEmitter<{ damage: DamageEvent<StatsComponent> }>();

    public health: number;
    public maxHealth: number;
    public healthRecoverySpeed: number;

    public power: number;
    public maxPower: number;
    public powerRecoverySpeed: number;

    public hardness: number;

    public healthResistance: number;
    public armorResistance: number;

    public isStale: boolean;

    public get isDead() {
        return this.health <= 0;
    }

    public readonly dependencies = [NetStateComponent];

    constructor(options: StatsComponentOptions) {
        super();

        this.health = options.health;
        this.maxHealth = options.maxHealth ?? options.health;
        this.healthRecoverySpeed = options.healthRecoverySpeed ?? 0;

        this.power = options.power;
        this.maxPower = options.maxPower ?? options.power;
        this.powerRecoverySpeed = options.powerRecoverySpeed ?? 0;

        this.healthResistance = options.healthResistance ?? 1;
        this.armorResistance = options.armorResistance ?? 1;

        this.hardness = options.hardness ?? 10;

        this.isStale = false;
    }

    onAdd(owner: Entity): void {
        this.events.on("damage", (evt) => {
            owner.events.emit(
                "damage",
                new DamageEvent(evt.target.owner!, evt.amount, evt.consumed, evt.direction)
            );
        });
    }

    onRemove(): void {
        this.events.clear();
    }

    public takeDamage(args: {
        damage: number;
        healthDeflection?: number;
        armorDeflection?: number;
        direction?: number | null;
    }): number {
        const { damage, healthDeflection = 1, armorDeflection = 1, direction = null } = args;

        if (damage <= 0.01) {
            return 0;
        }

        let damageAfterArmor = damage;
        let damageConsumed = 0;

        if (this.power > 0) {
            const damageOnArmor = (damage * armorDeflection) / this.armorResistance;
            const powerAfterDamage = this.power - damageOnArmor;

            damageAfterArmor = 0 - powerAfterDamage;
            damageConsumed = damageOnArmor - Math.max(0, damageAfterArmor);

            this.power = powerAfterDamage;
            this.isStale = true;
        }

        if (damageAfterArmor <= 0) {
            this.events.emit("damage", new DamageEvent(this, 0, damageConsumed, direction));
            return 0;
        }

        const damageOnHealth = (damageAfterArmor * healthDeflection) / this.healthResistance;
        const healthAfterDamage = this.health - damageOnHealth;

        this.health = healthAfterDamage;
        this.isStale = true;

        this.events.emit(
            "damage",
            new DamageEvent(this, damageOnHealth, damageConsumed, direction)
        );

        return damageOnHealth;
    }

    public consumePower(amount: number, params?: { allowPartial?: boolean; force?: boolean }) {
        amount = Math.abs(amount);

        if (params?.force) {
            this.power -= amount;
            this.isStale = true;
            return true;
        }

        if (params?.allowPartial && this.power > 0) {
            this.power -= amount;
            this.isStale = true;
            return true;
        }

        if (this.power >= amount) {
            this.power -= amount;
            this.isStale = true;
            return true;
        }

        return false;
    }
}

export class StatsSystem extends System {
    systemType: SystemType = SystemType.Update;
    priority = SystemPriority.Lowest;

    private query!: Query<typeof StatsComponent | typeof NetStateComponent>;

    constructor() {
        super();
    }

    initialize(world: World, _scene: Scene): void {
        this.query = world.query([StatsComponent]);
    }

    update(elapsedMs: number): void {
        let stats: StatsComponent;

        const delta = elapsedMs / 1000;
        const entities = this.query.entities as NetActor[];
        for (let i = 0; i < entities.length; i++) {
            stats = entities[i].get(StatsComponent);

            stats.health = Math.max(
                0,
                Math.min(stats.health + stats.healthRecoverySpeed * delta, stats.maxHealth)
            );
            stats.power = Math.max(
                0,
                Math.min(stats.power + stats.powerRecoverySpeed * delta, stats.maxPower)
            );

            if (stats.isStale && !entities[i].isReplica) {
                stats.isStale = false;

                entities[i].sendAction(
                    new StatsChangeAction({
                        health: stats.health,
                        power: stats.power,
                        hardness: stats.hardness,
                    }),
                    { self: false }
                );
            }
        }
    }
}
