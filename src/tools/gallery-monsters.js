// The monsters (GDD §6) in the character gallery.
import { createRockyModel } from '../entities/rocky.js';
import { createMushyModel } from '../entities/mushy.js';
import { createGolemModel } from '../entities/golem.js';

export default function registerMonsters(register) {
  const rocky = createRockyModel();
  const r = rocky.userData.rig;
  let rockyAwake = true, t = 0;
  register('Rocky', rocky, (dt) => {
    t += dt;
    r.lids.visible = !rockyAwake; r.eyes.visible = rockyAwake; r.feet.visible = rockyAwake;
    r.bodyG.position.y = rockyAwake ? Math.abs(Math.sin(t * 9)) * 0.15 : 0;
  }, [['깨어남', () => { rockyAwake = true; }], ['잠듦 (돌인 척)', () => { rockyAwake = false; }]]);

  const mushy = createMushyModel();
  register('Mushy', mushy, (dt) => { t += dt; mushy.userData.rig.ghost.position.y = Math.sin(t * 2) * 0.15 + 0.2; });

  const golem = createGolemModel();
  register('Crystal Golem', golem, (dt) => { t += dt; golem.rotation.y += dt * 0.4; golem.userData.rig.weak.children.forEach((c) => { c.material.emissiveIntensity = 1 + Math.sin(t * 6) * 0.5; }); });
}
