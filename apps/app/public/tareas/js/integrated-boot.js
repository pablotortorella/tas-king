// Static styles were externalized at build time; attach their classes before modules render.
document.querySelectorAll('[data-tasking-style]').forEach(node=>{node.classList.add(node.dataset.taskingStyle);if(node.dataset.taskingDisplay)node.style.display=node.dataset.taskingDisplay;node.removeAttribute('data-tasking-style');});
// Public HTML owns no account data; the suite owns profile editing and logout.

for(const id of ['adminNewEmail','statActiveUsers','statInactiveUsers','userActivityBar']){const node=document.getElementById(id);if(node)node.parentElement.hidden=true;}
for(const id of ['adminTabSolicitudes','adminPanelSolicitudes','adminBadge']){const node=document.getElementById(id);if(node)node.hidden=true;}

window.addEventListener('error',event=>{if(event.target?.classList?.contains('tasking-avatar-photo'))event.target.remove();},true);
