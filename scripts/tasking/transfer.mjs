#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,readFile,writeFile,mkdir,rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractTransfer,loadTransfer,verifyTransfer,commitTransfer,abortTransfer,TABLES } from '../../apps/app/src/tasking/transfer.js';
const exec=promisify(execFile),root=fileURLToPath(new URL('../../',import.meta.url));
const [action,environment,...options]=process.argv.slice(2);
if(!['staging','production'].includes(environment))throw new Error('Uso: transfer.mjs <status|drain|freeze|extract|load|verify|activate|abort|mark-moved|backup-files|restore-files> <staging|production> --directory <ruta privada fuera de Dropbox> [--local]');
const local=options.includes('--local');
const directoryOption=options.indexOf('--directory');
const directory=directoryOption>=0?resolve(options[directoryOption+1]):null;
if(!['status','drain','freeze','abort','mark-moved'].includes(action)&&(!directory||directory.includes('/Dropbox/')))throw new Error('El material privado requiere --directory fuera de Dropbox.');
if(directory)await mkdir(directory,{recursive:true,mode:0o700});
const scratch=await mkdtemp(join(tmpdir(),'tasking-transfer-'));
let n=0;
const sqlValue=value=>value===null?'NULL':typeof value==='number'&&Number.isFinite(value)?String(value):typeof value==='string'?"'"+value.replace(/'/g,"''")+"'":(()=>{throw new Error('Valor SQL inválido.');})();
function sqlText(sql,values){let i=0;const result=sql.replace(/\?/g,()=>sqlValue(values[i++]));if(i!==values.length)throw new Error('Parámetros SQL inconsistentes.');return result;}
async function cli(args){try{return (await exec('npx',['wrangler',...args],{cwd:root,maxBuffer:64*1024*1024})).stdout;}catch(error){const missing=/not found|does not exist|NoSuchKey|10007|404/i.test((error.stdout||'')+(error.stderr||''));const safe=new Error('Wrangler no pudo completar la operación. Verificar recursos y permisos del ambiente indicado.');safe.notFound=missing;throw safe;}}
const sourceConfig='wrangler.jsonc',targetConfig='apps/app/wrangler.jsonc';
function db(config,name){
 async function execute(statements){
  const file=join(scratch,`sql-${++n}.sql`);await writeFile(file,statements.join(';\n')+';\n',{mode:0o600});
  const output=await cli(['d1','execute',name,'--config',config,...(local?['--local','--persist-to',join(directory||scratch,'local-state')]:['--remote','--env',environment]),'--file',file,'--json']);
  const result=JSON.parse(output);if(result.some(r=>r.success===false||r.error))throw new Error('Falló la operación D1. Revisar el estado sin publicar datos privados.');return result;
 }
 function prepare(sql,values=[]){return {sql,values,bind(...args){return prepare(sql,args);},async all(){return (await execute([sqlText(sql,values)]))[0];},async first(){return (await this.all()).results?.[0]??null;},async run(){return (await execute([sqlText(sql,values)]))[0];}};}
 return {prepare,async batch(statements){return execute(statements.map(s=>sqlText(s.sql,s.values)));}};
}
function bucket(name,config){return {
 async get(key){
  if(!/^[\w./-]+$/.test(key)||key.includes('..'))throw new Error('Clave de objeto inválida.');
  const path=join(scratch,`object-${++n}`);
  try{await cli(['r2','object','get',name+'/'+key,'--config',config,...(local?['--persist-to',join(directory||scratch,'local-state')]:['--remote']),'--file',path]);const bytes=await readFile(path);return {arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),text:async()=>bytes.toString()};}
  catch(error){if(error.notFound)return null;throw new Error('No se pudo leer un objeto R2. Verificar permisos y existencia.');}
  finally{await rm(path,{force:true});}
 },
 async put(key,bytes,metadata={}){const file=join(scratch,`object-${++n}`);await writeFile(file,new Uint8Array(bytes),{mode:0o600});try{await cli(['r2','object','put',name+'/'+key,'--config',config,...(local?['--persist-to',join(directory||scratch,'local-state')]:['--remote']),'--file',file,'--content-type',metadata.httpMetadata?.contentType||'application/octet-stream','--force']);}finally{await rm(file,{force:true});}},
};}
const source=db(sourceConfig,local?'tas-king':environment==='staging'?'tas-king-staging':'tas-king');
const target=db(targetConfig,local?'homesuite-app-local':environment==='staging'?'homesuite-app-db-staging':'homesuite-app-db');
const sourceBucket=bucket(!local&&environment==='staging'?'tas-king-uploads-staging':'tas-king-uploads',sourceConfig);
const targetBucket=bucket(local?'homesuite-tasking-uploads-local':environment==='staging'?'homesuite-tasking-uploads-staging':'homesuite-tasking-uploads',targetConfig);
const manifest=()=>readFile(join(directory,'tasking-transfer.json'),'utf8').then(JSON.parse);
try{
 switch(action){
  case 'status':console.log(JSON.stringify({environment,local,source:(await source.prepare('SELECT phase FROM tasking_origin_control WHERE id=1').first())?.phase,inflight:(await source.prepare('SELECT COUNT(*) AS n FROM tasking_origin_leases').first())?.n,target:(await target.prepare('SELECT phase FROM tasking_transfer_state WHERE id=1').first())?.phase}));break;
  case 'drain':{
   await source.prepare("UPDATE tasking_origin_control SET phase='draining' WHERE id=1 AND phase='live'").run();
   const deadline=Date.now()+30000;
   while((await source.prepare('SELECT COUNT(*) AS n FROM tasking_origin_leases').first()).n){if(Date.now()>deadline)throw new Error('Hay peticiones en curso. No congelar ni cortar; verificar sus leases.');await new Promise(r=>setTimeout(r,250));}
   console.log('Origen drenado; todavía no activar el destino.');break;
  }
  case 'freeze':{
   const result=await source.prepare("UPDATE tasking_origin_control SET phase='frozen' WHERE id=1 AND phase='draining' AND NOT EXISTS(SELECT 1 FROM tasking_origin_leases)").run();
   if((await source.prepare('SELECT phase FROM tasking_origin_control WHERE id=1').first())?.phase!=='frozen')throw new Error('El origen no está drenado.');console.log('Origen congelado de forma persistente.');break;
  }
  case 'extract':{
   const snapshot=await extractTransfer(source,sourceBucket,{environment});await writeFile(join(directory,'tasking-transfer.json'),JSON.stringify(snapshot),{mode:0o600,flag:'wx'});console.log(JSON.stringify({phase:'extracted',tables:TABLES.length,files:snapshot.files.length,hash:snapshot.manifestHash}));break;
  }
  case 'load':await loadTransfer(target,targetBucket,sourceBucket,await manifest());console.log('Copia conciliada; destino listo pero sin admitir escrituras.');break;
  case 'verify':console.log(JSON.stringify(await verifyTransfer(target,targetBucket,await manifest())));break;
  case 'activate':await commitTransfer(source,target,targetBucket,sourceBucket,await manifest());console.log('Destino activo: HomeSuite es el único escritor. No reabrir el origen.');break;
  case 'abort':await abortTransfer(source,target);console.log('Aborto previo al cerrojo de activación: origen disponible. Destino continúa cerrado.');break;
  case 'mark-moved':if((await target.prepare('SELECT phase FROM tasking_transfer_state WHERE id=1').first())?.phase!=='active')throw new Error('Primero activar el destino conciliado.');await source.prepare("UPDATE tasking_origin_control SET phase='moved' WHERE id=1 AND phase='frozen'").run();console.log('Origen marcado como trasladado. Mantener el Worker de aviso.');break;
  case 'backup-files':{
   const snapshot=await manifest();const folder=join(directory,'files');await mkdir(folder,{recursive:true,mode:0o700});
   const {hash}=await import('../../apps/app/src/tasking/transfer.js');
   for(const file of snapshot.files){const object=await targetBucket.get(file.key);if(!object)throw new Error('Adjunto ausente.');const bytes=new Uint8Array(await object.arrayBuffer());if(await hash(bytes)!==file.hash)throw new Error('Adjunto diferente al manifiesto.');await writeFile(join(folder,file.hash),bytes,{mode:0o600});}
   console.log('Adjuntos respaldados y verificados.');break;
  }
  case 'restore-files':{
   if(!local)throw new Error('El ensayo de restauración de archivos sólo admite recursos locales aislados.');
   const snapshot=await manifest();const {hash}=await import('../../apps/app/src/tasking/transfer.js');
   for(const file of snapshot.files){const bytes=await readFile(join(directory,'files',file.hash));if(await hash(bytes)!==file.hash)throw new Error('Respaldo de adjunto corrupto.');await targetBucket.put(file.key,bytes,{httpMetadata:{contentType:file.mime}});}
   console.log('Adjuntos restaurados en destino local aislado.');break;
  }
  default:throw new Error('Acción desconocida.');
 }
}finally{await rm(scratch,{recursive:true,force:true});}
