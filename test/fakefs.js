(function(){
  var LS = window.localStorage;
  function files(){ try{return JSON.parse(LS.getItem('fakefs.files')||'{}');}catch(e){return {};} }
  function save(f){ LS.setItem('fakefs.files', JSON.stringify(f)); }
  function Dir(path,name){ this.path=path; this.name=name; this.kind='directory'; }
  function FH(path,name){ this.path=path; this.name=name; this.kind='file'; }
  function err(n){ var e=new Error(n); e.name=n; return e; }
  function off(){ return LS.getItem('fakefs.unplugged')==='1'; }
  Dir.prototype.getDirectoryHandle=function(n,o){ var p=this.path+n+'/', f=files();
    if(off()) return Promise.reject(err('NotFoundError'));
    var exists=f['__dir:'+p]; if(!exists && !(o&&o.create)) return Promise.reject(err('NotFoundError'));
    f['__dir:'+p]=1; save(f); return Promise.resolve(new Dir(p,n)); };
  Dir.prototype.getFileHandle=function(n,o){ var p=this.path+n, f=files();
    if(off()) return Promise.reject(err('NotFoundError'));
    if(!f[p] && !(o&&o.create)) return Promise.reject(err('NotFoundError'));
    if(!f[p]){ f[p]={t:'',m:Date.now()}; save(f);} return Promise.resolve(new FH(p,n)); };
  Dir.prototype.removeEntry=function(n){ var f=files(); delete f[this.path+n]; save(f); return Promise.resolve(); };
  Dir.prototype.values=function(){ var f=files(), out=[], k, pre=this.path, i=0;
    for(k in f){ if(k.indexOf('__dir:')!==0 && k.indexOf(pre)===0 && k.slice(pre.length).indexOf('/')<0){ out.push(new FH(k,k.slice(pre.length))); } }
    return { next:function(){ return Promise.resolve(i<out.length?{done:false,value:out[i++]}:{done:true}); } }; };
  Dir.prototype.queryPermission=function(){ return Promise.resolve(LS.getItem('fakefs.perm')||'granted'); };
  Dir.prototype.requestPermission=function(){ window.__reqPermCalls=(window.__reqPermCalls||0)+1; LS.setItem('fakefs.perm','granted'); return Promise.resolve('granted'); };
  FH.prototype.getFile=function(){ var rd=+(LS.getItem("fakefs.readdelay")||0), me=this; if(rd){ return new Promise(function(ok){setTimeout(ok,rd);}).then(function(){ LS.removeItem("fakefs.readdelay"); return me.getFile(); }); } var f=files()[this.path]; if(off()||!f) return Promise.reject(err('NotFoundError'));
    return Promise.resolve(new File([f.t],this.name,{lastModified:f.m})); };
  FH.prototype.createWritable=function(){ var self=this, buf=null;
    if(off()) return Promise.reject(err('NotFoundError'));
    /* C6f: fakefs.flaky = N next writes fail with fakefs.flakyname (default NoModificationAllowedError) */
    var fl=+(LS.getItem('fakefs.flaky')||0); if(fl>0){ LS.setItem('fakefs.flaky',String(fl-1)); window.__flakyHits=(window.__flakyHits||0)+1; return Promise.reject(err(LS.getItem('fakefs.flakyname')||'NoModificationAllowedError')); }
    return Promise.resolve({ write:function(d){ return (typeof d==='string'?Promise.resolve(d):d.text()).then(function(t){buf=t;}); },
      close:function(){ var dl=+(LS.getItem("fakefs.delay")||0); if(dl){ return new Promise(function(ok){setTimeout(ok,dl);}).then(function(){ var f=files(); f[self.path]={t:buf,m:Date.now()}; save(f); }); } if(off()) return Promise.reject(err('NotFoundError')); var f=files(); f[self.path]={t:buf,m:Date.now()}; save(f); var wc=JSON.parse(LS.getItem('fakefs.wc')||'{}'); wc[self.path]=(wc[self.path]||0)+1; LS.setItem('fakefs.wc',JSON.stringify(wc)); return Promise.resolve(); } }); };
  window.__fakeRoot=function(){ return new Dir('/','PENDRIVE-TESTE'); };
  /* fake IndexedDB just for the handle */
  Object.defineProperty(window,'indexedDB',{configurable:true,value:{ open:function(){ var req={}; setTimeout(function(){
    var db={ close:function(){}, transaction:function(){ var t={ objectStore:function(){ return {
      put:function(){ LS.setItem('fakefs.hasdir','1'); setTimeout(function(){t.oncomplete&&t.oncomplete();},0); },
      'delete':function(){ LS.removeItem('fakefs.hasdir'); setTimeout(function(){t.oncomplete&&t.oncomplete();},0); },
      get:function(){ var g={}; setTimeout(function(){ g.result=LS.getItem('fakefs.hasdir')?new Dir('/','PENDRIVE-TESTE'):undefined; g.onsuccess&&g.onsuccess(); },0); return g; } }; } }; return t; } };
    req.result=db; req.onsuccess&&req.onsuccess(); },0); return req; } }});
})();
