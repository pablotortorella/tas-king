#!/usr/bin/env node
// Inventario reproducible de los assets trasladados; no regenera ni sobreescribe código adaptado.
import { readFile,readdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { relative,join } from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),base=join(root,'apps/app/public/tareas');
async function files(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())result.push(...await files(path));else result.push(path);}return result.sort();}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const assets=[];for(const path of await files(base)){const bytes=await readFile(path);assets.push({path:'/tareas/'+relative(base,path),bytes:bytes.length,sha256:digest(bytes)});}
const original=await readFile(join(root,'public/favicon.svg')),moved=await readFile(join(base,'favicon.v1.svg'));
if(!original.equals(moved))throw new Error('El favicon trasladado difiere del original.');
const result=JSON.stringify({version:1,originalFaviconSha256:digest(original),assets},null,2)+'\n',manifest=join(root,'docs/tasking/assets.json');
if(process.argv.includes('--write'))await writeFile(manifest,result);else if(await readFile(manifest,'utf8')!==result)throw new Error('Inventario de assets desactualizado: node scripts/tasking/assets.mjs --write');
console.log(`Inventario comprobado: ${assets.length} assets; favicon original idéntico.`);
