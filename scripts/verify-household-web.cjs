const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { Buffer } = require('node:buffer');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
const occupied = await fetch('http://127.0.0.1:9333/json/list').then(() => true, () => false);
if (occupied) throw Error('Debug port 9333 is occupied. Close the previous test browser before retrying.');
const browserPath = process.env.FC_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if (!fs.existsSync(browserPath)) throw Error('Set FC_BROWSER_PATH to an installed Chromium/Edge executable.');
fs.mkdirSync('.expo', { recursive: true });
const browser = spawn(browserPath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9333', `--user-data-dir=${path.resolve('.expo/fc004-profile-' + Date.now())}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
const errors = [];
const server = http.createServer((req, res) => {
  const root = path.resolve('dist');
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8082, '127.0.0.1', resolve); });
  let pages;
  for (let i = 0; i < 40; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9333/json/list')).json(); break; } catch { await wait(250); }
  }
  if (!pages) throw Error('Edge debugging endpoint unavailable');
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(JSON.stringify(msg.params.args));
  });
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const key = ++id;
      const timeout = setTimeout(() => reject(Error(`CDP timeout: ${method}`)), 15000);
      pending.set(key, msg => { clearTimeout(timeout); if (msg.error) reject(Error(JSON.stringify(msg.error))); else resolve(msg.result); });
      socket.send(JSON.stringify({ id: key, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function expectText(text) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`)) return;
      await wait(500);
    }
    throw Error(`Missing text: ${text}; body: ${await evaluate('document.body.innerText')}`);
  }
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Page.bringToFront');
  await call('Page.navigate', { url: 'http://127.0.0.1:8082' });
  await expectText('Bienvenue !');
  async function clickText(text) {
    const found = await evaluate(`(() => { const el = [...document.querySelectorAll('[role="button"],a')].find(el => el.innerText === ${JSON.stringify(text)}); if (!el || el.getAttribute('aria-disabled') === 'true') return false; el.click(); return true; })()`);
    if (!found) throw Error('Missing enabled action: ' + text);
    await wait(150);
  }
  async function fill(label, value) {
    await evaluate(`(() => { const el = document.querySelector('input[aria-label=${JSON.stringify(label)}]'); if (!el) throw Error('Missing input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await wait(100);
  }
  const moduleFiles = ['src/services/localHousehold.web.js','src/services/householdService.js','src/services/storage/indexedDbStore.js','src/services/parent/pinCredential.js','src/core/assignments/normalizeAssignment.js','src/core/assignments/validateAssignment.js','src/core/assignments/practiceEligibility.js'];
  const sources = Object.fromEntries(moduleFiles.map(file => [file, fs.readFileSync(file, 'utf8')]));
  async function inOtherTab(expression) {
    const { targetId } = await call('Target.createTarget', { url: 'http://127.0.0.1:8082' });
    const pages = await (await fetch('http://127.0.0.1:9333/json/list')).json();
    const other = new WebSocket(pages.find(page => page.id === targetId).webSocketDebuggerUrl);
    await new Promise(resolve => other.addEventListener('open', resolve, { once: true }));
    await call('Target.activateTarget', { targetId });
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Other tab timeout')), 15000);
        other.addEventListener('message', event => {
          const message = JSON.parse(event.data);
          if (message.id === 1) { clearTimeout(timer); resolve(message); }
        });
        other.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
      });
      if (result.result.exceptionDetails || result.error) throw Error(JSON.stringify(result));
      return result.result.result.value;
    } finally { other.close(); await call('Target.closeTarget', { targetId }); await call('Page.bringToFront'); }
  }
  const loaderSource = `const sources=${JSON.stringify(sources)};const cache={};function load(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function('require','module','exports',sources[name])(ref=>load(new URL(ref+'.js','https://test/'+name).pathname.slice(1)),module,module.exports);return module.exports;}const testService=load('src/services/localHousehold.web.js').localHousehold;`;
  async function inject() {
    await evaluate(`(() => {
      const sources = ${JSON.stringify(sources)}; const cache = {};
      window.testLoad = function load(name) {
        if (cache[name]) return cache[name].exports;
        const module = { exports:{} }; cache[name] = module;
        new Function('require','module','exports',sources[name])(ref => load(new URL(ref + '.js', 'https://test/' + name).pathname.slice(1)), module, module.exports);
        return module.exports;
      };
      window.testService = window.testLoad('src/services/localHousehold.web.js').localHousehold;
    })()`);
  }
  await inject();
  await clickText('Parent Area');
  await expectText('Save household setup');
  await fill('New six-digit parent PIN', '123456');
  await fill('Confirm parent PIN', '123456');
  await clickText('Save household setup');
  await expectText('Setup saved.');
  await fill('Parent PIN', '123456');
  await clickText('Unlock Parent Area');
  await expectText('Saved policy: Parent approval required');
  await clickText('Allow independent practice');
  await expectText('Transcription or interpretation errors may remain.');
  if (await evaluate(`!![...document.querySelectorAll('[role="button"]')].find(el=>el.innerText==='Save practice policy' && el.getAttribute('aria-disabled')!=='true')`)) throw Error('Policy save enabled before acknowledgement');
  await evaluate(`document.querySelector('[role="checkbox"]').click()`);
  await clickText('Save practice policy');
  await expectText('Saved policy: Independent practice allowed');
  const testAssignment = { ...fixture, id: 'browser-household-lesson', title: 'Local browser test lesson' };
  await evaluate(`testService.submitAssignment(${JSON.stringify(testAssignment)})`);
  const unchanged = await evaluate(`(async()=>{const result=await testService.readPractice('browser-household-lesson');return result.document.assignment.reviewStatus==='pending_review' && result.document.approval===null && result.document.assignment.sources.every(s=>s.fidelity==='reported_teacher_content');})()`);
  if (!unchanged) throw Error('Independent mode altered review or fidelity');
  const serviceChecks = await evaluate(`(async()=>{
    const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
    let denied=false;try{await testService.setPracticePolicy({}, {expectedRevision:2,practiceMode:'require_parent_approval'});}catch{denied=true;}assert(denied,'forged capability');
    const createStore=testLoad('src/services/storage/indexedDbStore.js').createIndexedDbStore;
    const store=createStore(indexedDB,'fc004-transaction-tests');
    await store.update(()=>({value:1}));
    try{await store.update(s=>{s.value=2;throw Error('abort')});}catch{}
    assert((await store.read()).value===1,'abort rollback');
    try{await store.update(s=>({...s,bad:()=>{}}));}catch{}
    assert((await store.read()).value===1,'clone failure rollback');
    await Promise.all([store.update(s=>({value:s.value+1})),store.update(s=>({value:s.value+1}))]);
    assert((await store.read()).value===3,'serialized updates');
    return 'real IndexedDB rollback and concurrency passed';
  })()`);
  console.log(serviceChecks);
  await clickText('Return to student home');
  await expectText('Bienvenue !');
  await clickText('Commencer à pratiquer');
  await expectText('Local browser test lesson');
  await clickText('Local browser test lesson');
  await expectText('Cette leçon n’a pas encore été vérifiée par un parent.');
  await clickText('C’est parti !');
  await expectText('Question 1 sur 5');
  // A separate parent service/client changes the same persisted policy while student practice is active.
  const revocation = await inOtherTab(`(async()=>{${loaderSource}
    const token=await testService.unlock('123456');
    const p=await testService.getParentPolicy(token);
    await testService.setPracticePolicy(token,{expectedRevision:p.revision,practiceMode:'require_parent_approval'});
    let stale=false;try{await testService.setPracticePolicy(token,{expectedRevision:p.revision,practiceMode:'allow_independent_practice',acknowledgeRisk:true});}catch{stale=true;}
    testService.lock(); return stale;
  })()`);
  if (!revocation) throw Error('Stale write not rejected');
  await expectText('La pratique est en pause.');
  await call('Page.navigate', { url: 'http://127.0.0.1:8082/parent' });
  await expectText('Unlock Parent Area');
  if (await evaluate(`document.body.innerText.includes('Save practice policy')`)) throw Error('Reload kept unlock capability');
  await fill('Parent PIN', '000000');
  await clickText('Unlock Parent Area');
  await expectText('PIN not recognised.');
  await wait(1100);
  await fill('Parent PIN', '123456');
  await clickText('Unlock Parent Area');
  await expectText('Saved policy: Parent approval required');
  await inOtherTab(`new Promise(resolve=>setTimeout(()=>resolve(true),500))`);
  await expectText('Unlock Parent Area');
  await fill('Parent PIN', '123456');
  await clickText('Unlock Parent Area');
  await expectText('Saved policy: Parent approval required');
  await call('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  fs.writeFileSync('.expo/fc004-parent.png',Buffer.from(shot.data,'base64'));
  await clickText('Return to student home');
  await expectText('Bienvenue !');
  await clickText('Parent Area');
  await expectText('Unlock Parent Area');
  await call('Page.navigate', { url: 'http://127.0.0.1:8082/practice?mode=demo' });
  await expectText('Mes leçons');
  if (await evaluate(`document.body.innerText.includes('Démo') || document.body.innerText.includes('C’est parti')`)) throw Error('Production demo bypass');
  await call('Page.navigate', { url: 'http://localhost:8083' });
  await expectText('Bienvenue !');
  await clickText('Démo — contenu en attente de validation');
  await expectText('Jouons avec les mots !');
  await clickText('C’est parti !');
  await expectText('Question 1 sur 5');
  await expectText('Démo — contenu en attente de validation');
  if (errors.length) throw Error(JSON.stringify(errors));
  console.log('PASS FC-004: setup/default strict, risk opt-in, persistent pending practice, protected direct commands, IndexedDB failure rollback/concurrency, stale policy writes, live revocation, reload/leave locking, wrong PIN, production demo exclusion and development demo regression; no runtime/console errors.');
  await call('Browser.close');
} finally {
  socket?.close();
  browser.kill();
  server.close();
}
})().catch(error => { console.error(error); process.exitCode = 1; });
