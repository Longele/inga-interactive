/* Local-first delivery status. No page is reloaded without an explicit update action. */
(()=>{
  'use strict';
  const app=document.getElementById('app');
  if(!app) return;
  const button=document.createElement('button');
  button.id='offline-status'; button.type='button';
  button.textContent='Hors ligne'; button.setAttribute('aria-haspopup','dialog');
  const tools=app.querySelector('.tools [aria-label="Outils"]')||app.querySelector('.tools')||app;
  tools.append(button);
  const panel=document.createElement('div');
  panel.id='offline-panel'; panel.className='modal'; panel.hidden=true;
  panel.innerHTML='<section class="mbox" role="dialog" aria-modal="true" aria-labelledby="offline-title"><button type="button" class="x" id="offline-close" aria-label="Fermer la fenêtre hors ligne">×</button><div class="mhead"><div class="k">Installation sur cet appareil</div><h2 id="offline-title">Inga, même sans connexion</h2></div><div class="mbody"><p id="offline-summary" role="status" aria-live="polite"></p><progress id="offline-progress" aria-label="Ressources enregistrées" max="1" value="0"></progress><p id="offline-detail"></p><div class="btnrow"><button type="button" class="btn pri" id="offline-retry" hidden>Réessayer le téléchargement</button><button type="button" class="btn pri" id="offline-update" hidden>Installer la mise à jour</button><button type="button" class="btn" id="offline-check" hidden>Vérifier les mises à jour</button></div><p class="offline-help">Le navigateur conserve le plan, la maquette et toutes les narrations sur cet appareil. Gardez cette adresse en favori. Si les données du navigateur sont effacées, une connexion sera nécessaire pour les télécharger à nouveau.</p></div></section>';
  app.append(panel);
  const get=id=>document.getElementById(id);
  const state={mode:'checking',current:null,pending:null,error:'',updating:false,checking:false};
  let registration=null,refreshing=false,refreshAgain=false,pollTimer=0,applyTimer=0,applying=false;
  let watched=new WeakSet();
  const sync=()=>{if(typeof window.syncAccessibility==='function')window.syncAccessibility();};
  button.addEventListener('click',()=>{panel.hidden=false;sync();get('offline-close').focus();refresh();});
  get('offline-close').addEventListener('click',()=>{panel.hidden=true;if(typeof window.syncAccessibility==='function')sync();else button.focus();});
  panel.addEventListener('keydown',event=>{
    if(typeof window.syncAccessibility==='function') return;
    if(event.key==='Escape'){event.preventDefault();panel.hidden=true;button.focus();}
    if(event.key==='Tab'){
      const items=[...panel.querySelectorAll('button:not([hidden])')].filter(item=>!item.disabled);
      const at=items.indexOf(document.activeElement);
      if(event.shiftKey&&at<=0){event.preventDefault();items.at(-1).focus();}
      else if(!event.shiftKey&&at===items.length-1){event.preventDefault();items[0].focus();}
    }
  });
  function render(){
    const current=state.current,pending=state.pending,data=pending||current;
    let mode=state.mode,summary='',detail='';
    const connected=navigator.onLine;
    if(mode==='local'){
      summary='Dossier local : les fichiers sont lus directement sur cet appareil.';
      detail='Pour une borne avec installation hors ligne vérifiée, ouvrez cette expérience depuis son serveur local ou son adresse HTTPS.';
    }else if(mode==='unsupported'){
      summary='L’installation hors ligne n’est pas disponible dans ce navigateur ou à cette adresse.';
      detail='Utilisez un navigateur récent et l’adresse HTTPS du site, ou le serveur local de la borne.';
    }else if(state.updating){
      mode='updating';summary='Installation de la mise à jour…';detail='La page va redémarrer avec la version téléchargée.';
    }else if(pending&&pending.ready&&navigator.serviceWorker.controller&&registration&&registration.waiting){
      mode='update';summary='Une nouvelle version est téléchargée et prête à installer.';
      detail='Vous pouvez terminer votre visite. « Installer la mise à jour » redémarre cette page et remet la visite à zéro.';
      if(state.error)detail+=' L’installation n’a pas abouti ; réessayez.';
    }else if(pending&&pending.ready){
      mode='checking';summary='Finalisation du téléchargement…';detail='Vérification de l’installation sur cet appareil.';
    }else if(data&&data.phase==='downloading'){
      mode='downloading';summary=pending?'Téléchargement de la nouvelle version…':'Préparation de la visite hors ligne…';
      detail=data.cached+' / '+data.total+' fichiers enregistrés. Vous pouvez continuer votre visite.';
    }else if(data&&!data.ready){
      mode='incomplete';summary=pending?'La nouvelle version n’est pas entièrement téléchargée.':'Le téléchargement hors ligne est incomplet.';
      detail=data.cached+' / '+data.total+' fichiers enregistrés. '+(connected?'Réessayez pour récupérer les fichiers manquants.':'Reconnectez cet appareil, puis réessayez.');
      if(pending&&current&&current.ready)detail+=' La version actuelle reste disponible hors ligne.';
    }else if(current&&current.ready){
      mode='ready';summary='La visite complète est disponible hors ligne sur cet appareil.';
      detail=current.cached+' / '+current.total+' fichiers vérifiés, dont toutes les narrations. '+(connected?'Connexion disponible.':'Vous utilisez actuellement le mode hors ligne.');
      if(state.error)detail+=' La vérification des mises à jour n’a pas abouti ; vous pouvez réessayer.';
    }else if(state.error){
      mode='error';summary='La disponibilité hors ligne n’a pas pu être vérifiée.';
      detail=connected?'Réessayez. Si le problème persiste, vérifiez l’espace libre et les autorisations de stockage de ce navigateur.':'Reconnectez cet appareil, puis réessayez.';
    }else{mode='checking';summary='Vérification de la disponibilité hors ligne…';detail='La première visite télécharge aussi les fichiers audio.';}
    state.mode=mode;
    button.dataset.state=mode;
    button.title=summary;
    button.setAttribute('aria-label','Hors ligne : '+summary);
    get('offline-summary').textContent=summary;
    get('offline-detail').textContent=detail;
    const progress=get('offline-progress');
    progress.hidden=!data||['local','unsupported'].includes(mode);
    if(data){progress.max=data.total;progress.value=data.cached;}
    const retry=get('offline-retry');
    retry.hidden=!['incomplete','error'].includes(mode);
    retry.disabled=state.checking;
    get('offline-update').hidden=mode!=='update';
    get('offline-check').hidden=!['ready','update'].includes(mode);
    get('offline-check').disabled=state.checking;
    get('offline-check').textContent=state.checking?'Vérification…':'Vérifier les mises à jour';
    window.dispatchEvent(new CustomEvent('inga:offline',{detail:{...state}}));
  }
  function query(worker,command='INGA_OFFLINE_STATUS'){
    if(!worker)return Promise.resolve(null);
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel();
      const timeout=setTimeout(()=>{channel.port1.close();reject(new Error('Worker did not answer'));},5000);
      channel.port1.onmessage=event=>{clearTimeout(timeout);channel.port1.close();resolve(event.data);};
      try{worker.postMessage({type:command},[channel.port2]);}
      catch(error){clearTimeout(timeout);channel.port1.close();reject(error);}
    });
  }
  function watch(worker){
    if(!worker||watched.has(worker))return;
    watched.add(worker);
    worker.addEventListener('statechange',()=>{refresh();});
  }
  async function refresh(){
    if(!registration)return;
    if(refreshing){refreshAgain=true;return;}
    refreshing=true;
    try{
      const controller=navigator.serviceWorker.controller;
      const next=registration.waiting||registration.installing;
      watch(next);watch(registration.active);
      const [current,pending]=await Promise.allSettled([query(controller),query(next&&next!==controller?next:null)]);
      state.current=current.status==='fulfilled'?current.value:null;
      state.pending=pending.status==='fulfilled'?pending.value:null;
      state.error=current.status==='rejected'&&!state.pending?current.reason.message:pending.status==='rejected'?pending.reason.message:'';
      // An active worker without a controller does not yet guarantee an offline reload.
      if(!controller&&!state.pending)state.mode='checking';
    }catch(error){state.current=null;state.pending=null;state.error=error.message;}
    finally{
      refreshing=false;render();
      clearTimeout(pollTimer);
      if(refreshAgain){refreshAgain=false;pollTimer=setTimeout(refresh,80);}
      else if(['checking','downloading'].includes(state.mode))pollTimer=setTimeout(refresh,1000);
    }
  }
  async function register(){
    try{
      state.error='';
      registration=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
      registration.addEventListener('updatefound',()=>{watch(registration.installing);refresh();});
      watch(registration.installing);await refresh();
    }catch(error){state.error=error.message;render();}
  }
  get('offline-retry').addEventListener('click',async()=>{
    state.error='';state.checking=true;render();
    if(!registration){await register();}
    else{
      const worker=registration.waiting||registration.installing||navigator.serviceWorker.controller||registration.active;
      if(worker)worker.postMessage({type:'INGA_OFFLINE_RETRY'});
      else await register();
      await refresh();
    }
    state.checking=false;render();
  });
  get('offline-check').addEventListener('click',async()=>{
    if(!registration)return;
    state.checking=true;state.error='';render();
    try{await registration.update();await refresh();}
    catch(error){state.error=error.message;}
    finally{state.checking=false;render();}
  });
  get('offline-update').addEventListener('click',async()=>{
    if(!registration||!registration.waiting||!state.pending||!state.pending.ready)return;
    const worker=registration.waiting;
    try{
      const verified=await query(worker);
      if(!verified.ready){await refresh();return;}
      applying=true;state.updating=true;state.error='';render();
      clearTimeout(applyTimer);
      applyTimer=setTimeout(()=>{
        applying=false;state.updating=false;state.error='Update did not activate';render();
      },15000);
      const activated=await query(worker,'INGA_OFFLINE_ACTIVATE');
      if(!activated.accepted)throw new Error('Update is incomplete');
    }catch(error){clearTimeout(applyTimer);applying=false;state.error=error.message;state.updating=false;render();}
  });
  window.__INGA_OFFLINE={get state(){return {...state};},check:refresh};
  render();
  if(location.protocol==='file:'){state.mode='local';render();return;}
  if(!('serviceWorker' in navigator)||!window.isSecureContext){state.mode='unsupported';render();return;}
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data&&event.data.type==='INGA_OFFLINE_STATUS')refresh();
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(applying){clearTimeout(applyTimer);location.reload();return;}
    refresh();
  });
  window.addEventListener('online',()=>{render();refresh();});
  window.addEventListener('offline',()=>{render();refresh();});
  window.addEventListener('pageshow',()=>{refresh();});
  register();
})();
