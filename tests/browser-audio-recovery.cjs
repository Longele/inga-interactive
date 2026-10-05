const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    // A real unresolved network request must not keep the automatic tour busy forever.
    let hold=true;const held=[];
    await page.route('**/voix/stop1.mp3',r=>{if(hold){held.push(r);return;}return r.continue();});
    await page.goto(process.env.INGA_URL||'http://127.0.0.1:8001/index.html');
    await page.waitForFunction(()=>window.__INGA&&document.querySelector('#loading').classList.contains('gone'));
    await page.evaluate(()=>{
      // Rendering is covered separately; keep real browser media and clocks without software-GPU load.
      renderer.render=()=>{};
      window.__oldSpeak=speechSynthesis.speak;window.__oldCancel=speechSynthesis.cancel;
      window.__oldPause=speechSynthesis.pause;window.__oldResume=speechSynthesis.resume;
      window.__utterances=[];speechSynthesis.speak=u=>window.__utterances.push(u);speechSynthesis.cancel=()=>{};
      speechSynthesis.pause=()=>{};speechSynthesis.resume=()=>{};
      document.querySelector('#goTour').click();
    });
    await page.waitForFunction(()=>!NARR.busy&&document.querySelector('#tour-note button'),null,{timeout:35000});
    assert.deepEqual(await page.evaluate(()=>({step:TOUR.i,busy:NARR.busy,watch:!!NARR.watch,audio:!!NARR.audio,utterance:!!NARR.utterance,cached:!!NB.buf[0],pending:!!NB.prom[0]})),{step:0,busy:false,watch:false,audio:false,utterance:false,cached:false,pending:false});
    assert.match(await page.locator('#tour-note').innerText(),/continue avec le texte/);
    console.log('PASS: stalled MP3 request, HTML5 startup and silent speech recover to readable text with a retry action');

    hold=false;await Promise.all(held.map(r=>r.abort().catch(()=>{})));
    await page.locator('#tour-note button').click();
    await page.waitForFunction(()=>!!NB.src);
    assert.equal(await page.evaluate(()=>NARR.busy),true);
    await page.evaluate(()=>endTour());
    console.log('PASS: retry after a network timeout reloads and plays the recorded clip');

    // The same deadline also covers a decoder that never resolves, and rejects its late result.
    await page.evaluate(()=>{
      window.__oldLoadLimit=NARR_LIMITS.load;NARR_LIMITS.load=700;
      const c=narrCtx();window.__oldDecode=c.decodeAudioData;
      c.decodeAudioData=(ab,resolve)=>{window.__lateDecode=resolve;};
      window.__decodeResult=null;const originalFetch=fetch;
      window.fetch=()=>Promise.resolve({ok:true,arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8))});
      loadClip(3).then(()=>window.__decodeResult='resolved',()=>window.__decodeResult='rejected');window.fetch=originalFetch;
    });
    await page.waitForFunction(()=>window.__lateDecode&&window.__decodeResult==='rejected');
    assert.equal(await page.evaluate(()=>{window.__lateDecode(NB.buf[0]);return !!NB.buf[3];}),false);
    await page.evaluate(()=>{narrCtx().decodeAudioData=window.__oldDecode;NARR_LIMITS.load=window.__oldLoadLimit;});
    console.log('PASS: stalled decoder is bounded and cannot cache a late response');

    // Simulated HTML media progress: a long user pause must not consume the stall deadline.
    await page.evaluate(()=>{
      window.__oldNarrCtx=narrCtx;window.__oldAudio=Audio;narrCtx=()=>null;
      window.__oldLimits={...NARR_LIMITS};NARR_LIMITS.start=600;NARR_LIMITS.stall=600;NARR_LIMITS.speechStart=300;
      window.Audio=class{
        constructor(){this.currentTime=0;window.__testAudio=this;}
        play(){queueMicrotask(()=>this.onplaying&&this.onplaying());return Promise.resolve();}
        pause(){}removeAttribute(){}load(){}
      };
      startTour();
    });
    await page.waitForFunction(()=>NARR.audio&&document.querySelector('#tour-note').textContent.includes('Perle'));
    await page.evaluate(()=>document.querySelector('#tPlay').click());
    await page.waitForTimeout(850);
    assert.equal(await page.evaluate(()=>NARR.audio===window.__testAudio&&NARR.busy),true);
    await page.evaluate(()=>{document.querySelector('#tPlay').click();window.__staleMediaError=window.__testAudio.onerror;});
    await page.waitForFunction(()=>!NARR.busy&&document.querySelector('#tour-note button'));
    assert.equal(await page.evaluate(()=>{window.__staleMediaError();return NARR.audio;}),null);
    console.log('PASS: HTML playback stalls recover; Pause suspends the deadline and stale errors stay invalid');

    // Text recovery frees auto-advance. A retry button from the prior step must stay inactive.
    await page.evaluate(()=>{window.__staleRetry=document.querySelector('#tour-note button').onclick;TOUR.t=TOUR_STOPS[TOUR.i].dur;updateTour(.016);});
    assert.equal(await page.evaluate(()=>TOUR.i),1);
    assert.equal(await page.evaluate(()=>{const generation=NARR.generation;window.__staleRetry();return NARR.generation===generation;}),true);
    await page.evaluate(()=>{endTour();narrCtx=window.__oldNarrCtx;Audio=window.__oldAudio;Object.assign(NARR_LIMITS,window.__oldLimits);});
    console.log('PASS: text recovery permits auto-advance and an old retry cannot restart the previous step');

    // Every speech sentence needs its own startup deadline, including those queued after Resume.
    await page.evaluate(()=>{
      NARR_LIMITS.speechStart=250;window.__utterances=[];
      speechSynthesis.speak=u=>{window.__utterances.push(u);if(window.__utterances.length===1)u.onstart();};
      __INGA.applyPreset('multi');startTour();tourStop(6);
    });
    await page.evaluate(()=>{window.__utterances[0].onend();document.querySelector('#tPlay').click();});
    await page.waitForTimeout(850);
    assert.equal(await page.evaluate(()=>NARR.busy),true);
    await page.evaluate(()=>document.querySelector('#tPlay').click());
    await page.waitForFunction(()=>!NARR.busy&&document.querySelector('#tour-note button'));
    console.log('PASS: a later speech sentence that never starts recovers after Resume');

    // Speech can start and then stall without an end/error event. Trigger the real watchdog callback
    // without waiting a full spoken sentence; its generation checks and cleanup still execute.
    await page.evaluate(()=>{
      window.__utterances=[];speechSynthesis.speak=u=>{window.__utterances.push(u);u.onstart();};
      document.querySelector('#tour-note button').click();
      window.__staleSpeechStart=window.__utterances[0].onstart;
      window.__staleSpeechEnd=window.__utterances[0].onend;
      window.__speechDeadline=NARR.watch.remaining;NARR.watch.fail();
    });
    assert.ok(await page.evaluate(()=>window.__speechDeadline>=10000&&window.__speechDeadline<=60000));
    const count=await page.evaluate(()=>window.__utterances.length);
    await page.evaluate(()=>{window.__staleSpeechStart();window.__staleSpeechEnd();});
    assert.equal(await page.evaluate(()=>window.__utterances.length),count);
    assert.deepEqual(await page.evaluate(()=>({busy:NARR.busy,watch:!!NARR.watch,utterance:!!NARR.utterance})),{busy:false,watch:false,utterance:false});
    await page.evaluate(()=>{
      endTour();Object.assign(NARR_LIMITS,window.__oldLimits);
      speechSynthesis.speak=window.__oldSpeak;speechSynthesis.cancel=window.__oldCancel;
      speechSynthesis.pause=window.__oldPause;speechSynthesis.resume=window.__oldResume;
    });
    console.log('PASS: a speech playback deadline cancels playback and rejects late callbacks');
    assert.deepEqual(errors,[]);console.log('PASS: no browser errors');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
