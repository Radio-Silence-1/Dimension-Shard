
/*

*/


//comments are the old code that I have not updated.
let modName="dimensioncore"//got lazy
//Block
const block = extend(StorageBlock, 'core-construction-platform', {
    localizedName: "Core Construction Platform",
    description: "Requires 4.4k copper and lead, 3.2k silicon, and 2.6k titanium. Spawns a core when completed and powered.",
    hasItems: true,
    itemCapacity: 5000,
    setStats() {
        this.super$setStats();
    },
    /*setBars() {
        this.super$setBars();
        this.bars.add("items", func(entity => new Bar(
            prov(() => Core.bundle.format("bar.items", entity.items.total())),
            prov(() => Pal.items),
            floatp(() => entity.items.total() / entity.getMaxItemCapacity())
        )));
        this.bars.add("launchCount", func(entity => new Bar(
            prov(() => lib.getMessage("bar", "coreConstructionPlatformLaunchTimes", [
                entity.getLaunchTimes(),
                entity.getIsMain() ? entity.getRequirementInfo().launchCount : '-'
            ])),
            prov(() => Pal.items),
            floatp(() => entity.getLaunchTimes() / entity.getRequirementInfo().launchCount)
        )));
    },*/
    outputsItems() {
        return false;
    }
})
block.buildVisibility = BuildVisibility.shown;
block.category = Category.effect;
block.canOverdrive = false;
block.solid = true;
block.update = true;
block.destructible = true;
block.hasItems = true;
block.itemCapacity=5000;
//block.consumes.items = ItemStack.with(Items.copper, 100)
block.size = 3;
block.requirements = ItemStack.with(
    Items.copper, 700,
    Items.lead, 700,
    Items.silicon, 400,
    Items.titanium, 400,
    Items.thorium, 320,
);
block.consumePower(25);



var platformGroup = {};
var mainBuilding = {};
var cores = {};
for (var team of Team.baseTeams) {
    platformGroup[team.id] = new Seq();
    mainBuilding[team.id] = null;
    cores[team.id] = 0;
}



function checkCores() {
    for (var team of Team.baseTeams) {
        var newSize = team.cores().size;
        // print('cores[' + team.id + ']: ' + cores[team.id] + ', newSize: ' + newSize + ', mainBuilding[team.id]: ' + mainBuilding[team.id]);
        if (cores[team.id] != newSize && mainBuilding[team.id] != null) {
            mainBuilding[team.id].makeMain(newSize);
        }
        cores[team.id] = newSize;
    }
}




function selectMainBuilding(team) {
    if (Vars.net.client()) { return; }
    // print('select');
    if (mainBuilding[team.id] != null) {
        // print('fuxked');
        return;
    }
    const group = platformGroup[team.id];
    // print('group.isEmpty: ' + group.isEmpty());
    if (!group.isEmpty()) {
        const main = group.get(0);
        mainBuilding[team.id] = main;
        mainBuilding[team.id].makeMain(main.team.cores().size);
    }
}




function createPod() {
    return new JavaAdapter(LaunchPayload, {
        toString() {
            return "CoreConstructionPlatformPod#" + this.id;
        },
        draw() {
            const engineColor = Pal.engine;
            var alpha = this.fout(Interp.pow5Out);
            var scale = (1 - alpha) * 1.3 + 1;
            var cx = this.cx();
            var cy = this.cy();
            var rotation = this.fin() * (130 + Mathf.randomSeedRange(this.id, 50));
            Draw.z(Layer.effect + 0.001);
            Draw.color(engineColor);
            var rad = 0.2 + this.fslope();
            Tmp.c2.set(engineColor).a = alpha;
            Tmp.c1.set(engineColor).a = 0;
            Fill.light(cx, cy, 10, 25 * (rad + scale - 1), Tmp.c2, Tmp.c1);
            Draw.alpha(alpha);
            for (var i = 0; i < 4; i++) {
                Drawf.tri(cx, cy, 6, 40 * (rad + scale - 1), i * 90 + rotation);
            }
            Draw.color();
            Draw.z(Layer.weather - 1);
            var region = Core.atlas.find(modName + '-' + "core-construction-platform-pod");
            var rw = region.width * Draw.scl * scale;
            var rh = region.height * Draw.scl * scale;
            Draw.alpha(alpha);
            Draw.rect(region, cx, cy, rw, rh, rotation);
            Tmp.v1.trns(225, this.fin(Interp.pow3In) * 250);
            Draw.z(Layer.flyingUnit + 1);
            Draw.color(0, 0, 0, 0.22 * alpha);
            Draw.rect(region, cx + Tmp.v1.x, cy + Tmp.v1.y, rw, rh, rotation);
            Draw.reset();
        },
        remove() {
            if (this.added == false) return;
            Groups.all.remove(this);
            Groups.draw.remove(this);
            this.added = false;
        },
    });
}



const fxGateOpen = new Effect(30, cons(e => {
    Draw.color(Color.red);
    Draw.alpha(e.fout());
    Draw.rect(UnitTypes.dagger.region, e.x, e.y);
}));
const fxGateClose = new Effect(30, cons(e => {
    Draw.color(Color.valueOf("#3494c4"));
    Draw.alpha(e.fout());
    Draw.rect(UnitTypes.dagger.region, e.x, e.y);
}));


block.buildType = () => extend(StorageBlock.StorageBuild, block, {
    _isMain: true,
    _launchTimes: 0,
    _toCoreDelay: 1000,
    _launchDelay: 1000,
    _readyLaunch: false,
    _ready: false,
    _spawnCore: 60*1.5,//this variable is mine (radio silence), it is, and will be, used badly.
    _requirementInfoIndex: 0,
    _afterLaunchTime: 0,
    
    makeMain(cores) {
        this._isMain = true;
        this._requirementInfoIndex = cores;
    },
    setLaunchTimes(times) {
        this._launchTimes = times
    },
    getLaunchTimes() {
        return this._launchTimes
    },
    getIsMain() {
        return this._isMain;
    },
    getReadyLaunch() {
        return this._readyLaunch;
    },







    
    doLaunch() {
        this._launchTimes += 1;
        //this.items.clear();
        this._readyLaunch = false;
        this._launchDelay = 100;

        Fx.launchPod.at(this);
        const entity = createPod();
        entity.set(this);
        entity.lifetime = 120;
        entity.team = this.team;
        entity.add();
        Effect.shake(3, 3, this);

        this._afterLaunchTime = 10;
    },
    becomeCore() {
        if(this._spawnCore <= 0){
            Fx.placeBlock.at(this.tile, Blocks.coreShard.size);
            Fx.upgradeCore.at(this.tile, Blocks.coreShard.size);
            Fx.launch.at(this.tile);
            Effect.shake(5, 5, this.tile);
            this.tile.setBlock(Blocks.coreShard, this.team);
            if (!Vars.net.client()) {
                checkCores();
            }
        }
        else{
            this._spawnCore-=1
        }
    },
    afterAdded() {//hmm
        if (!platformGroup[this.team.id].contains(this)) {
            platformGroup[this.team.id].add(this);
            if (this._isMain && !Vars.net.client()) {
                this.makeMain(this.team.cores().size);
            }
        }
    },
    // -=-=-=-=-=-=-=-=-=- divide -=-=-=-=-=-=-=-=-=-
    created() {
        this.super$created();
        this.afterAdded();
    },
    canPickup() {
        return false;
    },
    fullFilled() {//efficiency dies here
        var tile = Vars.world.tile(this.x / 8, this.y / 8);
    
        // Check for copper
        var copperAmount = tile.build.items.get(Items.copper);
        if (copperAmount != null && copperAmount <= 4400) {
            return false;
        }
        
        // Check for lead
        var leadAmount = tile.build.items.get(Items.lead);
        if (leadAmount != null && leadAmount <= 4400) {
            return false;
        }
    
        // Check for silicon
        var siliconAmount = tile.build.items.get(Items.silicon);
        if (siliconAmount != null && siliconAmount <= 3200) {
            return false;
        }
    
        // Check for titanium
        var titaniumAmount = tile.build.items.get(Items.titanium);
        if (titaniumAmount != null && titaniumAmount <= 2600) {
            return false;
        }
        return true
    },
    updateTile() {
        this.super$updateTile();
        if (this._isMain) {
            var requirementInfo = null;
            if (!this._readyLaunch && this.fullFilled()) {//if item requirements
                this._readyLaunch = true;
                this._launchDelay = 150;
                fxGateOpen.at(this);
                //Log.err("not readyLaunch")
            }
            if (this._readyLaunch) {
                this._launchDelay -= this.edelta();
                //Log.err("lauchDelete-=: "+this._launchDelay)
            }
            if (this._launchDelay <= 0 && !Vars.net.client()) {
                this.doLaunch();
                //Log.err("doLaunch"+this)
            }
        }
        if (this._isMain) {
            // If ready, no power needs
            if (!this._ready && this._launchTimes === 1) {
                this._ready = true;
                this._toCoreDelay = 10;
                //Log.err("ready true")
            }
            if (this._ready) {
                this._toCoreDelay -= this.delta();
                //Log.err("add more to core delay?")
            }
            if (this._toCoreDelay <= 0) {
                this.becomeCore();
                //Log.err("final state (become core)")
            }

            // There is only UI effect, no power need
            var before = this._afterLaunchTime;
            this._afterLaunchTime = Math.max(0, this._afterLaunchTime - this.delta());
            if (before != 0 && this._afterLaunchTime == 0) {
                fxGateClose.at(this);
            }
        }
    },
    draw() {
        const SCL = 32 / 8;
        const DIST2 = 29;
        const DIST1 = 15;
        if (this._readyLaunch && this._launchDelay > 0) {
            // After ready before launch
            var maxTime = Math.min(60 * 1.5, (60*4));
            var percent = Mathf.clamp(((60*4) - this._launchDelay) / maxTime, 0, 1);
            percent = Interp.smooth2.apply(percent);
            /*
            Core.atlas.find("testing" + '-' + "core-construction-platform-pod");
            */
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-bottom"), this.x, this.y);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-pod"), this.x, this.y);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left2"), this.x - DIST2 * percent / SCL, this.y);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left1"), this.x - DIST1 * percent / SCL, this.y);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left2"), this.x, this.y - DIST2 * percent / SCL, 90);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left1"), this.x, this.y - DIST1 * percent / SCL, 90);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left2"), this.x + DIST2 * percent / SCL, this.y, 180);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left1"), this.x + DIST1 * percent / SCL, this.y, 180);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left2"), this.x, this.y + DIST2 * percent / SCL, 270);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left1"), this.x, this.y + DIST1 * percent / SCL, 270);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-top"), this.x, this.y);
        } else if (this._afterLaunchTime > 0) {
            // After ready before launch
            var maxTime = (60 * 1.5);
            var percent = Mathf.clamp((maxTime - this._afterLaunchTime) / maxTime, 0, 1);
            percent = Interp.smooth2.apply(1 - percent);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-bottom"), this.x, this.y);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left2"), this.x - DIST2 * percent / SCL, this.y);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left1"), this.x - DIST1 * percent / SCL, this.y);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left2"), this.x, this.y - DIST2 * percent / SCL, 90);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left1"), this.x, this.y - DIST1 * percent / SCL, 90);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left2"), this.x + DIST2 * percent / SCL, this.y, 180);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left1"), this.x + DIST1 * percent / SCL, this.y, 180);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left2"), this.x, this.y + DIST2 * percent / SCL, 270);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-gate-left1"), this.x, this.y + DIST1 * percent / SCL, 270);
            Draw.rect(Core.atlas.find(modName + '-' + "core-construction-platform-top"), this.x, this.y);
        } else {
            this.super$draw();
        }
        if (this._ready && this._spawnCore <= 45) {
            const region = Blocks.coreShard.region;
            const teamRegion = Blocks.coreShard.teamRegion;
            var percent = (1 - Math.min(1, this._toCoreDelay / (60 * 1.5)))
            const w = region.width * Draw.scl * Draw.xscl * (1 + 2 * (1 - percent));
            const h = region.height * Draw.scl * Draw.xscl * (1 + 2 * (1 - percent));
            const yAddition = 192 * Interp.pow3In.apply(1 - percent);
            Draw.z(Layer.weather + 1);
            Draw.alpha(percent)
            Draw.rect(region, this.x, this.y , w, h, this._toCoreDelay * 2);
            Draw.color(this.team.color);
            Draw.alpha(percent)
            Draw.rect(teamRegion, this.x, this.y , w, h, this._toCoreDelay * 2);
            Draw.reset();
        }
    },
    
    write(write) {
        this.super$write(write);
        write.bool(this._isMain);
        write.i(this._requirementInfoIndex);
        write.i(this._launchTimes);
        write.f(this._toCoreDelay);
        write.bool(this._ready);
        write.bool(this._readyLaunch);
        write.f(this._launchDelay);
    }
    
});






Events.on(BlockBuildEndEvent, cons(e => {
    checkCores();
    const team = e.team;
    if (!e.breaking && e.tile.block() == block) {
        selectMainBuilding(team);
    }
}));
Events.on(BlockDestroyEvent, cons(e => {
    checkCores();
}));
Events.on(WorldLoadEvent, cons(e => {
    checkCores();
    for (var team of Team.baseTeams) {
        selectMainBuilding(team);
    }
}));