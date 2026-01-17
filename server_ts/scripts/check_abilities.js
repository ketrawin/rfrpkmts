const fs = require('fs');
const path = require('path');
const pokPath = path.join(__dirname, '..', '..', 'server', 'data', 'pokemon.json');
let s = fs.readFileSync(pokPath, 'utf8');
s = s.replace(/\/\/[^\n\r]*/g,'');
const pok = JSON.parse(s);
const set = new Set();
for(const k of Object.keys(pok)){ if(pok[k].ability1) set.add(pok[k].ability1); if(pok[k].ability2) set.add(pok[k].ability2); }
const abilities = Array.from(set).sort();
const abFilePath = path.join(__dirname, '..', 'src', 'abilities.ts');
const abFile = fs.readFileSync(abFilePath,'utf8').toLowerCase();
const implemented = [];
const missing = [];
for(const a of abilities){ if(a && abFile.indexOf(a.toLowerCase()) !== -1) implemented.push(a); else missing.push(a); }
console.log('totalAbilities:', abilities.length);
console.log('implemented:', implemented.length, implemented.sort());
console.log('missing:', missing.length, missing.sort());
