const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const base=(process.env.INGA_TEST_URL||'http://127.0.0.1:8001').replace(/\/$/,'');
const inside=async (page,selector)=>{
 const r=await page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height,w:innerWidth,h:innerHeight}});
 assert.ok(r.width>0&&r.height>0&&r.x>=-1&&r.y>=-1&&r.right<=r.w+1&&r.bottom<=r.h+1,`${selector}: ${JSON.stringify(r)}`);
};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-webgl']});
 try{
  // Navigation and model remain usable on machines without WebGL.
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce',hasTouch:true});
  const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.IngaProduct&&window.__INGA&&document.querySelector('#loading').classList.contains('gone'));
  assert.equal(await page.locator('#tourBtn').isDisabled(),true);
  assert.equal(await page.locator('#fallback').isVisible(),true);
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(()=>!document.querySelector('.mobile-options-group').hidden);
   for(const selector of ['.tools','.tabbar','#mobile-options','#mobile-learn'])await inside(page,selector);
   assert.equal(await page.locator('#openReg').isVisible(),false);
   await page.locator('#mobile-options').click();await inside(page,'#tools-panel .mbox');
   for(const selector of ['#openReg','#resetAll','#learningBtn','#offline-status']){assert.equal(await page.locator(selector).isVisible(),true);await inside(page,selector);}
   await page.locator('#openReg').click();
   assert.equal(await page.locator('#tools-panel').isVisible(),false);assert.equal(await page.locator('#reg').isVisible(),true);
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'mobile-options');
   await page.locator('#mobile-learn').click();assert.equal(await page.locator('#learning').isVisible(),true);
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'mobile-learn');
   await page.locator('[data-mob="dash"]').click();
   await page.evaluate(()=>__INGA.applyPreset('grid'));
   assert.match(await page.locator('#mf-generation').textContent(),/900 MW/);
   assert.match(await page.locator('#mf-delivered').textContent(),/855 MW/);
   assert.equal(await page.locator('[data-flow="grid"]').evaluate(el=>el.classList.contains('is-limiting')),true);
   assert.equal(await page.locator('#dash').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   await page.locator('[data-mob="none"]').click();
   console.log(`PASS navigation, dialogs and vertical balance at ${width}×${height}`);
  }
  await page.locator('#mobile-options').click();await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(()=>document.querySelector('#tools-panel').hidden&&document.querySelector('#openReg').closest('.tools'));
  assert.equal(await page.locator('#openReg').isVisible(),true);assert.equal(await page.locator('#offline-status').isVisible(),true);
  await inside(page,'.tools');await inside(page,'#ctrl');
  await page.locator('#openReg').click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'openReg');
  assert.deepEqual(await page.evaluate(()=>__INGA.runValidation().filter(t=>!t.ok)),[]);
  assert.deepEqual(errors,[]);
  console.log('PASS desktop restoration, no-WebGL fallback and all model checks');
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
