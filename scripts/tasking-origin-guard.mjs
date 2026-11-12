import { execFileSync } from 'node:child_process';
const environment=process.argv[2];
if(!['staging','production'].includes(environment))throw new Error('Indicar staging o production.');
const db=environment==='production'?'tas-king':'tas-king-staging';
const args=['wrangler','d1','execute',db,'--remote','--json','--config','wrangler.jsonc',...(environment==='staging'?['--env','staging']:[]),'--command','SELECT phase FROM tasking_origin_control WHERE id=1'];
const output=execFileSync('npx',args,{encoding:'utf8'});
const result=JSON.parse(output);const phase=result[0]?.results?.[0]?.phase;
if(phase!=='live')throw new Error('El TasKing original está cerrado para la mudanza. Sólo se puede publicar el Worker de aviso; no reactivar esta copia.');
