import { TaskingError } from './db/helpers.js';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const join=(a,b)=>{const c=new Uint8Array(a.length+b.length);c.set(a);c.set(b,a.length);return c;};
function indexOf(bytes,pattern){outer:for(let i=bytes.indexOf(pattern[0]);i>=0&&i<=bytes.length-pattern.length;i=bytes.indexOf(pattern[0],i+1)){for(let j=1;j<pattern.length;j++)if(bytes[i+j]!==pattern[j])continue outer;return i;}return -1;}
// Reads one file at a time. Memory is bounded by the per-file limit, not all files in a request.
export async function* multipartFiles(request,{totalLimit,fileLimit}){
  const match=/^multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(request.headers.get('Content-Type')||'');
  const boundary=match?.[1]||match?.[2];
  if(!boundary||boundary.length>70||/[\r\n]/.test(boundary))throw new TaskingError('Formulario inválido.',400);
  if(Number(request.headers.get('Content-Length'))>totalLimit)throw new TaskingError('La solicitud es demasiado grande.',413);
  const reader=request.body?.getReader();if(!reader)throw new TaskingError('Formulario vacío.',400);
  let buffer=new Uint8Array(),total=0,ended=false;
  async function more(){const chunk=await reader.read();if(chunk.done){ended=true;return false;}total+=chunk.value.length;if(total>totalLimit)throw new TaskingError('La solicitud es demasiado grande.',413);buffer=join(buffer,chunk.value);return true;}
  const marker=encoder.encode('\r\n--'+boundary),first=encoder.encode('--'+boundary+'\r\n');
  try{
    while(buffer.length<first.length&&!ended)await more();
    if(indexOf(buffer,first)!==0)throw new TaskingError('Formulario inválido.',400);buffer=buffer.slice(first.length);
    for(;;){
      let stop;while((stop=indexOf(buffer,encoder.encode('\r\n\r\n')))===-1){if(buffer.length>8192||!await more())throw new TaskingError('Cabecera de archivo inválida.',400);}
      const headers=decoder.decode(buffer.slice(0,stop));buffer=buffer.slice(stop+4);
      const name=/\bname="([^"]*)"/i.exec(headers)?.[1],filename=/\bfilename="([^"\r\n]*)"/i.exec(headers)?.[1];
      const mime=/^content-type:\s*([^\r\n]+)/im.exec(headers)?.[1]?.trim().toLowerCase()||'application/octet-stream';
      const chunks=[];let size=0;
      function retain(value){size+=value.length;if(size>fileLimit)throw new TaskingError('Archivo demasiado grande (máx. 20 MiB).',413);chunks.push(value);}
      while((stop=indexOf(buffer,marker))===-1){const n=Math.max(0,buffer.length-marker.length);if(n){retain(buffer.slice(0,n));buffer=buffer.slice(n);}if(!await more())throw new TaskingError('Archivo incompleto.',400);}
      retain(buffer.slice(0,stop));buffer=buffer.slice(stop+marker.length);
      if(filename!==undefined){if(name!=='files')throw new TaskingError('Campo de archivo inválido.',400);const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}yield {name:filename,mime,bytes};}
      while(buffer.length<2&&!ended)await more();
      if(buffer[0]===45&&buffer[1]===45){await reader.cancel();return;}
      if(buffer[0]!==13||buffer[1]!==10)throw new TaskingError('Límite de archivo inválido.',400);buffer=buffer.slice(2);
    }
  }finally{if(!ended)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
