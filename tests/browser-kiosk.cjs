const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=(process.env.INGA_TEST_URL||'http://127.0.0.1:8001').replace(/\/$/,'');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:768},serviceWorkers:'block',reducedMotion:'reduce'});page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const now=performance.now.bind(performance);window.__idleOffset=0;performance.now=()=>now()+window.__idleOffset;});
  await page.goto(base+'/musee.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__INGA&&document.querySelector('#loading').classList.contains('gone'));
  await page.evaluate(()=>{renderer.render=()=>{};__INGA.jump(99);NARR.on=false;});
  // A paused visitor session must release all dialogs and return to an automatic tour.
  await page.evaluate(()=>{__INGA.tour(0);});await page.locator('#tPlay').click();
  await page.evaluate(()=>{window.__idleOffset+=61000;});
  await page.waitForFunction(()=>!TOUR.on&&document.querySelectorAll('.modal:not([hidden])').length===0);
  await page.waitForFunction(()=>TOUR.on&&TOUR.playing);
  console.log('PASS abandoned paused tour resets and restarts');
  // A returning visitor cancels the delayed restart; no unexpected takeover.
  await page.locator('#tQuit').click();
  await page.evaluate(()=>{IngaProduct.open();window.__idleOffset+=61000;});
  await page.waitForFunction(()=>document.querySelector('#learning').hidden);
  await page.locator('#openReg').click();
  await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(()=>TOUR.on),false);assert.equal(await page.locator('#reg').isVisible(),true);
  console.log('PASS visitor input cancels scheduled kiosk restart');
  await page.keyboard.press('Escape');
  for(const id of ['tools-panel','offline-panel']){
   await page.evaluate(id=>{document.getElementById(id).hidden=false;syncAccessibility();window.__idleOffset+=61000;},id);
   await page.waitForFunction(()=>document.querySelectorAll('.modal:not([hidden])').length===0);
   await page.waitForFunction(()=>TOUR.on&&TOUR.playing);
   assert.equal(await page.locator('#tPlay').evaluate(el=>!!el.closest('[inert]')),false);
   await page.locator('#tQuit').click();
   console.log(`PASS idle recovery closes ${id} before restarting`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
