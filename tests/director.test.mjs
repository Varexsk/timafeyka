import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.CIRK_DATA = fs.mkdtempSync(path.join(os.tmpdir(),'cirk-director-'));
const types = await import('../server/types.js'); await types.default.load();
const {store} = await import('../server/store.js');
const {applyCommand:send,activeContests} = await import('../server/commands.js');
const {playShow,playRuntime} = await import('../server/project.js');
function reset() { store.load(); store.resetToSeed(); }
test('антракт замораживает таймер и навигацию, затем восстанавливает время и музыку',()=>{
  reset(); send('timerStart',{seconds:60}); send('dj',{src:'media/song.mp3',playing:true});
  store.runtime.dj.startedAt -= 5000;
  const screen = store.runtime.screen, originalEnd = store.runtime.timer.endsAt;
  send('intermission',{on:true});
  assert.equal(store.runtime.timer.running,false);
  assert.equal(send('next').ok,false); assert.equal(send('goto',{contestIndex:1}).ok,false);
  assert.equal(send('timerDone',{seq:store.runtime.timer.seq}).ok,false);
  assert.equal(store.runtime.screen,screen);
  const seq = store.runtime.intermission.seq;
  send('intermission',{on:true}); assert.equal(store.runtime.intermission.seq,seq);
  store.runtime.intermission.at -= 10000;
  send('intermission',{on:false});
  assert.ok(store.runtime.timer.endsAt >= originalEnd + 10000);
  assert.equal(store.runtime.timer.running,true);
  assert.equal(store.runtime.dj.playing,true); assert.ok(store.runtime.dj.position >= 5);
});
test('антракт не запускает заранее приостановленный таймер',()=>{
  reset(); send('timerStart',{seconds:60}); send('timerPause');
  send('intermission',{on:true}); send('intermission',{on:false});
  assert.equal(store.runtime.timer.running,false);
});
test('антракт замораживает время фотоальбома',()=>{
  reset();
  send('album',{frames:[{src:'media/a.jpg'},{src:'media/b.jpg'}],open:true,playing:true});
  const start = store.runtime.album.startedAt;
  send('intermission',{on:true}); store.runtime.intermission.at -= 10000;
  send('intermission',{on:false});
  assert.equal(store.runtime.album.open,true);
  assert.ok(store.runtime.album.startedAt >= start + 10000);
});
test('выход пары атомарно выбирает двух гостей и защищён от двойного нажатия',()=>{
  reset(); store.guests.list = ['a','b','c'].map(id=>({id,name:id}));
  send('directorCue',{kind:'entrance',ids:['a','b'],count:2});
  assert.deepEqual(store.runtime.partyDraw.picks.map(p=>p.id).sort(),['a','b']);
  assert.equal(store.runtime.fx.type,'drumroll');
  assert.equal(send('directorCue',{kind:'entrance',ids:['c'],count:1}).ok,false);
  assert.equal(store.runtime.partyDraw.picks.length,2);
});
test('награда сохраняется отдельно от баллов, а репетиция не пополняет альбом',()=>{
  reset(); const guest = store.guests.list[0], score = guest.score;
  send('directorCue',{kind:'gift',guestId:guest.id,title:'Мастер улыбки'});
  assert.equal(store.show.honors.length,1); assert.equal(guest.score,score);
  assert.equal(store.runtime.lionAct.kind,'gift');
  send('rehearsal',{on:true}); send('directorCue',{kind:'gift',guestId:guest.id});
  assert.equal(store.show.honors.length,1);
});
test('резерв пропускается программой, но запускается вручную',()=>{
  reset(); const c = store.show.contests[1];
  send('planUpdate',{id:c.id,reserve:true,minutes:8,props:'Два мяча'});
  assert.equal(activeContests().some(x=>x.id===c.id),false);
  send('planLaunch',{id:c.id});
  assert.equal(store.runtime.contestId,c.id); assert.equal(c.enabled,true); assert.equal(c.durationMinutes,8);
});
test('письма в будущее вырезаны: команд нет, старые данные вычищаются',()=>{
  reset();
  assert.equal(send('capsuleOpen',{open:true}).ok,false);
  assert.equal(send('capsuleLetter',{id:'letter-test-1',name:'Бабушка',wish:'Расти'}).ok,false);
  store.show.capsule = {open:true,letters:[{id:'x',name:'Бабушка',wish:'Расти'}]};
  store.runtime.capsuleStage = {open:true};
  store.flush(); store.load();
  assert.equal(store.show.capsule,undefined);
  assert.equal(store.runtime.capsuleStage,undefined);
  assert.equal('capsule' in playShow(store.show),false);
  send('intermission',{on:true});
  assert.deepEqual(playRuntime(store.runtime,'',store.show).intermission,{open:true});
});
