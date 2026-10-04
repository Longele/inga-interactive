const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    if(process.env.INGA_PREVIEW) await page.route('**/index.html',r=>r.fulfill({body:fs.readFileSync(process.env.INGA_PREVIEW),contentType:'text/html'}));
    let release,requested;
    const gate=new Promise(r=>release=r),signal=new Promise(r=>requested=r);
    await page.route('**/voix/stop1.mp3',async r=>{requested();await gate;await r.continue();});
    await page.goto(process.env.INGA_URL||'http://127.0.0.1:8001/index.html');
    await page.waitForFunction(()=>window.__INGA&&document.querySelector('#loading').classList.contains('gone'));
    await page.evaluate(()=>{window.__plays=0;const original=nbPlay;nbPlay=(...args)=>{window.__plays++;return original(...args);};document.querySelector('#goTour').click();});
    await signal;
    await page.evaluate(()=>document.querySelector('#tQuit').click());
    release();
    await page.waitForFunction(()=>!!NB.buf[0]);
    assert.deepEqual(await page.evaluate(()=>({tour:TOUR.on,busy:NARR.busy,source:!!NB.src,plays:window.__plays})),{tour:false,busy:false,source:false,plays:0});
    console.log('PASS: late successful MP3 response cannot restart narration after Quit');

    await page.evaluate(()=>{startTour();document.querySelector('#tPlay').click();});
    await page.waitForFunction(()=>!!NARR.pending);
    assert.equal(await page.evaluate(()=>!!NB.src),false);
    await page.evaluate(()=>document.querySelector('#tPlay').click());
    await page.waitForFunction(()=>!!NB.src);
    console.log('PASS: pause while loading defers playback until Resume');

    await page.evaluate(()=>{endTour();window.__plays=0;startTour();endTour();startTour();});
    await page.waitForFunction(()=>!!NB.src);
    assert.equal(await page.evaluate(()=>window.__plays),1);
    console.log('PASS: reopening the same stop invalidates the previous narration generation');

    await page.evaluate(()=>{endTour();window.__plays=0;window.__originalLoadClip=loadClip;loadClip=()=>Promise.reject(new Error('test delayed error'));startTour();endTour();});
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(()=>({audio:!!NARR.audio,source:!!NB.src,busy:NARR.busy,plays:window.__plays})),{audio:false,source:false,busy:false,plays:0});
    await page.evaluate(()=>{loadClip=window.__originalLoadClip;});
    console.log('PASS: late load failure cannot start HTML5 or speech fallback after Quit');

    await page.evaluate(()=>{
      window.__originalNarrCtx=narrCtx;window.__originalAudio=Audio;narrCtx=()=>null;
      window.__fakeAudios=[];window.Audio=class {
        constructor(){this.pauses=0;window.__fakeAudios.push(this);} play(){return new Promise(resolve=>{this.resolve=resolve;});}
        pause(){this.pauses++;} removeAttribute(){} load(){}
      };
      startTour(); const a=NARR.audio; window.__oldPlaying=a.onplaying;window.__oldError=a.onerror;
      document.querySelector('#tPlay').click(); a.resolve(); a.onplaying();
    });
    assert.equal(await page.evaluate(()=>TOUR.playing),false);
    assert.ok(await page.evaluate(()=>window.__fakeAudios[0].pauses>=2));
    await page.evaluate(()=>{endTour();window.__oldPlaying();window.__oldError();});
    assert.equal(await page.evaluate(()=>NARR.audio),null);
    assert.equal(await page.evaluate(()=>window.__fakeAudios.length),1);
    await page.evaluate(()=>{narrCtx=window.__originalNarrCtx;window.Audio=window.__originalAudio;});
    console.log('PASS: HTML5 delayed playing/error callbacks respect Pause and Quit');

    await page.evaluate(()=>{
      window.__originalSpeak=speechSynthesis.speak;window.__originalCancel=speechSynthesis.cancel;
      window.__originalSpeechPause=speechSynthesis.pause;window.__originalSpeechResume=speechSynthesis.resume;
      window.__speechState={paused:false,started:[]};window.__utterances=[];
      speechSynthesis.speak=u=>{window.__utterances.push(u);if(!window.__speechState.paused){window.__speechState.started.push(u.text);u.onstart();}};
      speechSynthesis.pause=()=>{window.__speechState.paused=true;};speechSynthesis.resume=()=>{window.__speechState.paused=false;};speechSynthesis.cancel=()=>{};
      __INGA.applyPreset('multi');startTour();tourStop(6);
    });
    assert.ok(await page.evaluate(()=>window.__utterances.length>0));
    assert.equal(await page.evaluate(()=>NARR.audio),null);
    assert.equal(await page.evaluate(()=>NB.src),null);
    const beforeSpeechPause=await page.evaluate(()=>({queued:window.__utterances.length,started:window.__speechState.started.length}));
    await page.evaluate(()=>{
      document.querySelector('#tPlay').click();
      // A sentence may finish as Pause takes effect; its next sentence must wait for Resume.
      window.__utterances.at(-1).onend();
    });
    assert.deepEqual(await page.evaluate(()=>({paused:window.__speechState.paused,playing:TOUR.playing,pending:!!NARR.pending,queued:window.__utterances.length,started:window.__speechState.started.length})),{paused:true,playing:false,pending:true,...beforeSpeechPause});
    await page.evaluate(()=>document.querySelector('#tPlay').click());
    assert.deepEqual(await page.evaluate(()=>({paused:window.__speechState.paused,playing:TOUR.playing,pending:!!NARR.pending,queued:window.__utterances.length,started:window.__speechState.started.length})),{paused:false,playing:true,pending:false,queued:beforeSpeechPause.queued+1,started:beforeSpeechPause.started+1});
    console.log('PASS: Resume unpauses speech before starting a sentence deferred during Pause');
    const words=await page.evaluate(()=>{
      let guard=0;while(NARR.busy&&window.__utterances.at(-1)?.onend&&guard++<20)window.__utterances.at(-1).onend();
      return window.__utterances.map(u=>u.text).join(' ');
    });
    assert.match(words,/Groupes disponibles/);
    await page.evaluate(()=>{tourStop(6);window.__staleSpeechEnd=window.__utterances.at(-1).onend;endTour();});
    const count=await page.evaluate(()=>window.__utterances.length);
    await page.evaluate(()=>window.__staleSpeechEnd());
    assert.equal(await page.evaluate(()=>window.__utterances.length),count);
    await page.evaluate(()=>{speechSynthesis.speak=window.__originalSpeak;speechSynthesis.cancel=window.__originalCancel;speechSynthesis.pause=window.__originalSpeechPause;speechSynthesis.resume=window.__originalSpeechResume;});
    console.log('PASS: step 7 speaks the current group constraint; cancelled speech cannot enqueue more sentences');

    await page.evaluate(()=>{NARR.on=false;startTour();tourStop(4);});
    await page.waitForTimeout(300);
    const offsets=await page.evaluate(()=>({y:viewOffY,actualY:camera.view.offsetY,x:Math.abs(viewShift)>0.5?-viewShift:0,actualX:camera.view.offsetX,enabled:camera.view.enabled}));
    assert.ok(offsets.y>0);assert.equal(offsets.actualY,offsets.y);assert.equal(offsets.actualX,offsets.x);assert.equal(offsets.enabled,true);
    const cam=await page.evaluate(()=>camera.position.toArray());
    await page.evaluate(()=>{TOUR.t=7;updateTour(.016);});
    assert.deepEqual(await page.evaluate(()=>camera.position.toArray()),cam);
    console.log('PASS: tour vertical framing survives render and reduced-motion camera stays still');
    assert.deepEqual(errors,[]);console.log('PASS: no browser errors');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
