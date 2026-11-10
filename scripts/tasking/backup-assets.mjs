#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { resolve,join } from 'node:path';
const run=promisify(execFile);
const [action,environment,destination,prefix]=process.argv.slice(2);
if(!['staging','production'].includes(environment)||!destination)throw new Error('Indicar acción, ambiente y carpeta privada del respaldo.');
const local=process.argv.includes('--local');
const stateIndex=process.argv.indexOf('--state');
const directory=resolve(destination);if(directory.includes('/Dropbox/'))throw new Error('Los respaldos privados deben quedar fuera de Dropbox.');
const localState=stateIndex>=0?resolve(process.argv[stateIndex+1]):join(directory,'local-state');
if(local&&localState.includes('/Dropbox/'))throw new Error('Usar estado local aislado fuera de Dropbox.');
const uploads=local?'homesuite-tasking-uploads-local':environment==='production'?'homesuite-tasking-uploads':'homesuite-tasking-uploads-staging';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifestPath=join(directory,'tasking-files.json'),folder=join(directory,'tasking-files');
await mkdir(folder,{recursive:true,mode:0o700});
async function cli(args){try{await run('npx',['wrangler',...args.flatMap(arg=>arg==='--remote'&&local?['--persist-to',localState,'--config','apps/app/wrangler.jsonc']:arg)],{maxBuffer:2*1024*1024});}catch{throw new Error('Falló la copia R2 del respaldo de adjuntos. No se completará el backup.');}}
function rowsFromSql(sql){const db=new DatabaseSync(':memory:');try{db.exec('PRAGMA foreign_keys=OFF');db.exec(sql);if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasking_attachments'").get())return [];return db.prepare('SELECT stored_name AS key,size,mime FROM tasking_attachments ORDER BY stored_name').all();}finally{db.close();}}
async function verify(){const manifest=JSON.parse(await readFile(manifestPath,'utf8'));if(manifest.version!==1)throw new Error('Versión de archivos no soportada.');const expected=rowsFromSql(await readFile(join(directory,'database.sql'),'utf8'));if(expected.length!==manifest.files.length)throw new Error('El respaldo omite adjuntos del SQL.');for(const row of expected){const file=manifest.files.find(f=>f.key===row.key);if(!file||file.size!==row.size||file.mime!==row.mime||!/^[a-f0-9]{64}$/.test(file.hash))throw new Error('El manifiesto no corresponde al SQL.');const bytes=await readFile(join(folder,file.hash));if(bytes.length!==file.size||hash(bytes)!==file.hash)throw new Error('Adjunto de backup ausente o corrupto.');}return manifest;}
if(action==='collect'){
 const files=[];
 for(const row of rowsFromSql(await readFile(join(directory,'database.sql'),'utf8'))){if(!/^[\w.-]{1,180}$/.test(row.key)||row.size>20*1024*1024)throw new Error('Adjunto fuera del contrato de TasKing.');const path=join(folder,'download');await cli(['r2','object','get',uploads+'/'+row.key,'--remote','--file',path]);const bytes=await readFile(path);if(bytes.length!==row.size)throw new Error('Tamaño del adjunto diferente al export SQL.');const digest=hash(bytes);await rename(path,join(folder,digest));files.push({...row,hash:digest});}
 await writeFile(manifestPath,JSON.stringify({version:1,files}),{mode:0o600});await verify();console.log(`Adjuntos respaldados y verificados: ${files.length}.`);
}else if(action==='verify'){
 const manifest=await verify();console.log(`Restauración de adjuntos comprobada: ${manifest.files.length}.`);
}else if(action==='restore'){
 if(!local)throw new Error('Restaurar archivos sólo en el ensayo local aislado.');
 const manifest=await verify();
 for(const file of manifest.files)await cli(['r2','object','put',uploads+'/'+file.key,'--remote','--file',join(folder,file.hash),'--content-type',file.mime,'--force']);
 console.log(`Adjuntos restaurados en R2 local: ${manifest.files.length}.`);
}else if(action==='upload'){
 if(environment!=='production'||!/^production\/[0-9]{8}T[0-9]{6}Z$/.test(prefix||''))throw new Error('Prefijo de respaldo inválido.');
 const manifest=await verify();
 for(const file of manifest.files)await cli(['r2','object','put','homesuite-app-backups/'+prefix+'/tasking-files/'+file.hash,'--remote','--file',join(folder,file.hash),'--content-type','application/octet-stream','--force']);
 await cli(['r2','object','put','homesuite-app-backups/'+prefix+'/tasking-files.json','--remote','--file',manifestPath,'--content-type','application/json','--force']);
}else if(action==='download'){
 if(environment!=='production'||!/^production\/[0-9]{8}T[0-9]{6}Z$/.test(prefix||''))throw new Error('Prefijo inválido.');
 await cli(['r2','object','get','homesuite-app-backups/'+prefix+'/tasking-files.json','--remote','--file',manifestPath]);
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 if(manifest.version!==1||!Array.isArray(manifest.files))throw new Error('Manifiesto de archivos inválido.');
 for(const file of manifest.files){if(!/^[a-f0-9]{64}$/.test(file.hash))throw new Error('Hash de archivo inválido.');await cli(['r2','object','get','homesuite-app-backups/'+prefix+'/tasking-files/'+file.hash,'--remote','--file',join(folder,file.hash)]);}
 await verify();
}else throw new Error('Acción desconocida.');
