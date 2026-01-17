import path from 'path';
import fs from 'fs';
import type { IPokemon, IMove } from './types/pokemon';

function loadJsonStripComments(filename: string) {
  const p = path.join(__dirname, '../data', filename);
  let txt = fs.readFileSync(p, 'utf8');
  // strip single-line comments left by legacy files
  txt = txt.replace(/\/\/[^\n\r]*/g, '');
  return JSON.parse(txt);
}

const pokemonData: Record<string, any> = loadJsonStripComments('pokemon.json');
const movesData: Record<string, any> = loadJsonStripComments('moves.json');
const experienceRequired: any = loadJsonStripComments('experienceRequired.json').experienceRequired;

function randInt(min: number, max: number) {
  return min + Math.floor((max - min + 1) * Math.random());
}

function createRandomString(len: number) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

export class Pokemon {
  id: string = '';
  level: number = 1;
  unique: string = '';
  nickname: string | null = null;
  gender: number = 0;
  shiny: boolean = false;

  hp = 0; maxHp = 0; atk = 0; def = 0; spAtk = 0; spDef = 0; speed = 0;
  ability = 0; nature = 0;
  experience = 0; experienceNeeded = 0;
  ivHp = 0; ivAtk = 0; ivDef = 0; ivSpAtk = 0; ivSpDef = 0; ivSpeed = 0;
  evHp = 0; evAtk = 0; evDef = 0; evSpAtk = 0; evSpDef = 0; evSpeed = 0;
  status = 0; virus = 0;
  moves: Array<string | null> = [null, null, null, null];
  movesPP: number[] = [0, 0, 0, 0];
  movesMaxPP: number[] = [0, 0, 0, 0];
  battleStats: { learnableMoves: string[]; atkPower: number; defPower: number; spAtkPower: number; spDefPower: number; speedPower: number; accuracy: number; evasion: number } = {
    learnableMoves: [], atkPower: 0, defPower: 0, spAtkPower: 0, spDefPower: 0, speedPower: 0, accuracy: 0, evasion: 0
  };

  constructor() {}

  createWild(id_: string, level_: number) {
    this.id = id_;
    this.level = level_;
    this.unique = createRandomString(16);

    const pdata = pokemonData[id_];
    if (!pdata) throw new Error('Unknown pokemon id ' + id_);
    if (pdata.genderRatio !== undefined && pdata.genderRatio !== -1) {
      this.gender = Math.random() < pdata.genderRatio ? 1 : 2;
    } else this.gender = 0;

    this.nature = randInt(1, 25);

    if (pdata.ability2 != null) this.ability = randInt(1, 2);
    else if (pdata.ability1 != null) this.ability = 1;
    else this.ability = 0;

    this.experience = 0;

    this.hp = this.atk = this.def = this.spAtk = this.spDef = this.speed = 0;
    this.evHp = this.evAtk = this.evDef = this.evSpAtk = this.evSpDef = this.evSpeed = 0;

    this.ivHp = randInt(0, 31);
    this.ivAtk = randInt(0, 31);
    this.ivDef = randInt(0, 31);
    this.ivSpAtk = randInt(0, 31);
    this.ivSpDef = randInt(0, 31);
    this.ivSpeed = randInt(0, 31);

    this.status = 0;
    this.virus = 0;
    this.shiny = Math.random() < (1 / 8192);

    // learn moves from learnset up to this.level (legacy cycles through 4 slots)
    let j = 0;
    if (Array.isArray(pdata.learnset)) {
      for (const entry of pdata.learnset) {
        if (!entry || typeof entry.move !== 'string') continue;
        if (entry.level > this.level) continue;
        this.learnMove(j, entry.move);
        j = (j + 1) % 4;
      }
    }

    this.calculateStats();
    this.hp = this.maxHp;

    if (!this.moves[0]) this.learnMove(0, 'tackle');

    return this;
  }

  // Level up the pokemon by 1 and return moves learned at this level (legacy behavior)
  levelUp(): { movesLearned: string[] } {
    const movesLearned: string[] = [];
    const oldMaxHp = this.maxHp;

    this.level += 1;
    this.calculateStats();

    if (this.hp > 0) this.hp += this.maxHp - oldMaxHp;

    const data = pokemonData[this.id];
    if (data.evolveLevel != null && this.level >= data.evolveLevel) {
      this.id = data.evolveTo;
    }

    const learnset = pokemonData[this.id].learnset;
    if (Array.isArray(learnset)) {
      for (const m of learnset) {
        if (!m || !m.move) continue;
        if (!movesData[m.move]) {
          console.warn('Move "' + m.move + '" doesn\'t exist for ' + (pokemonData[this.id] && pokemonData[this.id].name));
          continue;
        }

        if (m.level === -1 && this.moves.indexOf(m.move) === -1) {
          // move learned on evolution, handled above
        } else if (m.level !== this.level) {
          continue;
        }

        let learnedMove = false;
        for (let i = 0; i < 4; ++i) {
          if (!this.moves[i]) {
            this.learnMove(i, m.move);
            movesLearned.push(m.move);
            learnedMove = true;
            break;
          }
        }

        if (!learnedMove) {
          this.battleStats.learnableMoves.push(m.move);
        }
      }
    }

    return { movesLearned };
  }

  learnMove(slot: number, move: string) {
    if (slot < 0 || slot >= 4) return;
    if (!movesData[move]) return;
    this.moves[slot] = move;
    this.movesMaxPP[slot] = this.movesPP[slot] = movesData[move].pp || 0;
  }

  calculateStats() {
    const base = pokemonData[this.id].baseStats;
    const level = this.level;
    const calcSingle = (b: number, iv: number, ev: number) => Math.floor((iv + 2 * b + Math.floor(ev / 4)) * level / 100 + 5);
    this.maxHp = Math.floor((((this.ivHp + 2 * base.hp) + Math.floor(this.evHp / 4) + 100) * level) / 100 + 10);
    const tatk = calcSingle(base.atk, this.ivAtk, this.evAtk);
    const tdef = calcSingle(base.def, this.ivDef, this.evDef);
    const tspAtk = calcSingle(base.spAtk, this.ivSpAtk, this.evSpAtk);
    const tspDef = calcSingle(base.spDef, this.ivSpDef, this.evSpDef);
    const tspeed = calcSingle(base.speed, this.ivSpeed, this.evSpeed);

    // apply nature multipliers (match legacy Haxe ordering)
    // mapping 1..25 -> increased stat, decreased stat (21-25 are neutral)
    const nmList = [
      null,
      ['atk','def'], ['atk','spAtk'], ['atk','spDef'], ['atk','speed'],
      ['def','atk'], ['def','spAtk'], ['def','spDef'], ['def','speed'],
      ['spAtk','atk'], ['spAtk','def'], ['spAtk','spDef'], ['spAtk','speed'],
      ['spDef','atk'], ['spDef','def'], ['spDef','spAtk'], ['spDef','speed'],
      ['speed','atk'], ['speed','def'], ['speed','spAtk'], ['speed','spDef'],
      null, null, null, null, null
    ];

    const nm = (this.nature >= 1 && this.nature < nmList.length) ? nmList[this.nature] : null;
    // apply multipliers to the temporary totals then floor like legacy
    let _tatk = tatk, _tdef = tdef, _tspAtk = tspAtk, _tspDef = tspDef, _tspeed = tspeed;
    if (nm) {
      const inc = nm[0] as string;
      const dec = nm[1] as string;
      if (inc === 'atk') _tatk *= 1.1; if (dec === 'atk') _tatk *= 0.9;
      if (inc === 'def') _tdef *= 1.1; if (dec === 'def') _tdef *= 0.9;
      if (inc === 'spAtk') _tspAtk *= 1.1; if (dec === 'spAtk') _tspAtk *= 0.9;
      if (inc === 'spDef') _tspDef *= 1.1; if (dec === 'spDef') _tspDef *= 0.9;
      if (inc === 'speed') _tspeed *= 1.1; if (dec === 'speed') _tspeed *= 0.9;
    }

    this.atk = Math.floor(_tatk);
    this.def = Math.floor(_tdef);
    this.spAtk = Math.floor(_tspAtk);
    this.spDef = Math.floor(_tspDef);
    this.speed = Math.floor(_tspeed);

    if (level >= 100) this.experienceNeeded = 0;
    else {
      const curve = pokemonData[this.id].experienceCurve;
      // legacy mapping: erratic:0, fast:1, mediumFast:2, mediumSlow:3, slow:4, fluctuating:5
      const curveIdx = (curve === 'erratic' ? 0 : curve === 'fast' ? 1 : curve === 'mediumFast' ? 2 : curve === 'mediumSlow' ? 3 : curve === 'slow' ? 4 : curve === 'fluctuating' ? 5 : 2);
      try { this.experienceNeeded = experienceRequired[level][curveIdx]; } catch (e) { this.experienceNeeded = 0; }
    }
  }

  getAbilityName(): string {
    if (!this.ability || this.ability === 0) return '';
    const pdata = pokemonData[this.id];
    if (!pdata) return '';
    return (pdata as any)['ability' + this.ability] || '';
  }

  generateSave(): IPokemon {
    const fields = ["id","level","unique","gender","ability","experience","nature","status","virus","shiny","moves","movesPP","movesMaxPP","hp","evHp","evAtk","evDef","evSpAtk","evSpDef","evSpeed","ivHp","ivAtk","ivDef","ivSpAtk","ivSpDef","ivSpeed"];
    const sav: any = {};
    for (const f of fields) sav[f] = (this as any)[f];
    return sav as IPokemon;
  }
}

export function createStarterPokemonFromId(id: string) {
  const p = new Pokemon();
  p.createWild(id, 5);
  return p.generateSave() as IPokemon;
}
