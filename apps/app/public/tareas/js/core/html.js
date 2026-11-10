// HTML templates are owned by TasKing. Dynamic text remains escaped by the caller.
// Styles are inserted through CSSOM into a same-origin stylesheet, never inline attributes.
let sequence=0;
const styles=new Map();
function styleClass(value){
  if(styles.has(value))return styles.get(value);
  if(/url\s*\(|expression\s*\(|@import|[<>]/i.test(value))return '';
  const sheet=document.querySelector('link[data-tasking-runtime]')?.sheet;
  if(!sheet)return '';
  const id='tasking-dynamic-'+(++sequence);
  try{sheet.insertRule('.'+id+'{'+value+'}',sheet.cssRules.length);styles.set(value,id);return id;}catch{return '';}
}
export function setHTML(element,value){
  const template=document.createElement('template');
  const markup=String(value??'').replace(/\sstyle="([^"]*)"/gi,(_,style)=>' data-tasking-css="'+style.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"');
  template.innerHTML=markup;
  template.content.querySelectorAll('script,iframe,object,embed,base,meta,link').forEach(node=>node.remove());
  template.content.querySelectorAll('*').forEach(node=>{
    for(const attribute of Array.from(node.attributes)){
      if(/^on/i.test(attribute.name)||attribute.name==='srcdoc')node.removeAttribute(attribute.name);
      if(['href','src','action','formaction'].includes(attribute.name)){
        const value=attribute.value.replace(/[\u0000-\u0020]/g,'');
        if(!/^(?:\/(?!\/)|#|https:\/\/|blob:)/i.test(value))node.removeAttribute(attribute.name);
      }
    }
    if(node.dataset.taskingCss!==undefined){let value=node.dataset.taskingCss;if(/(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/.test(value)){node.style.display='none';value=value.replace(/(^|;)\s*display\s*:\s*none\s*(?=;|$)/, '$1');}const cls=styleClass(value);if(cls)node.classList.add(cls);node.removeAttribute('data-tasking-css');}
    if(node.target==='_blank')node.rel='noopener noreferrer';
  });
  element.replaceChildren(template.content);
}
