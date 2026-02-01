// Dashboard runtime (keep broadly compatible: avoid optional chaining)

(function(){
  function setText(id, text){
    var el = document.getElementById(id);
    if(el) el.textContent = text;
  }

  // Show *something* immediately so users know JS is running.
  setText('dataStatus', 'js: running…');

  window.addEventListener('error', function(e){
    try {
      var msg = (e && e.message) ? e.message : String(e);
      setText('dataStatus', 'error: ' + msg);
    } catch (_) {}
  });

  function fmtDate(iso){
    try { return new Date(iso).toLocaleString(); } catch (_) { return iso; }
  }

  function markActive(btnIds, activeId){
    for(var i=0;i<btnIds.length;i++){
      var id = btnIds[i];
      var el = document.getElementById(id);
      if(!el) continue;
      if(id === activeId) el.setAttribute('aria-current','page');
      else el.removeAttribute('aria-current');
    }
  }

  function fetchJson(path){
    return fetch(path, {cache: 'no-store'}).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status + ' for ' + path);
      return r.json();
    });
  }

  function renderKpis(){
    return fetchJson('./data/meta.json').then(function(meta){
      setText('lastUpdated', fmtDate(meta.generated_at));

      setText('kpiRespValue', meta.kpis.respiratory.value);
      setText('kpiRespNote', meta.kpis.respiratory.note);

      setText('kpiWasteValue', meta.kpis.wastewater.value);
      setText('kpiWasteNote', meta.kpis.wastewater.note);

      setText('kpiHospValue', meta.kpis.hospital.value);
      setText('kpiHospNote', meta.kpis.hospital.note);

      setText('kpiVaxValue', meta.kpis.vax.value);
      setText('kpiVaxNote', meta.kpis.vax.note);

      setText('dataStatus', 'data: ok');
    });
  }

  function vegaReady(){
    return typeof window.vegaEmbed === 'function';
  }

  function renderPublicChart(kind){
    var noteEl = document.getElementById('publicChartNote');

    var dataPath, title, yTitle;
    if(kind === 'resp'){
      dataPath = './data/respiratory_deaths_state_weekly.json';
      title = 'Deaths (weekly) — statewide';
      yTitle = 'Deaths';
      if(noteEl) noteEl.textContent = 'Source: Respiratory Virus Dashboard Metrics (Deaths).';
    } else if(kind === 'waste'){
      dataPath = './data/wastewater_state_weekly.json';
      title = 'Wastewater concentration (weekly median) — statewide';
      yTitle = 'PCR target avg concentration (median)';
      if(noteEl) noteEl.textContent = 'Source: Wastewater Surveillance California (pcr_target_avg_conc).';
    } else {
      dataPath = './data/vax_state_weekly.json';
      title = 'Vaccination (weekly) — statewide';
      yTitle = 'Count';
      if(noteEl) noteEl.textContent = 'Source: Vaccine Progress Dashboard (administered doses & up-to-date counts).';
    }

    return fetchJson(dataPath).then(function(values){
      if(!vegaReady()){
        // At least show that data loaded even if charts are blocked.
        if(noteEl) noteEl.textContent = (noteEl.textContent || '') + ' (Charts unavailable: vegaEmbed not loaded. Your network may block CDNs.)';
        return;
      }

      var spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 320,
        title: { text: title, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700 },
        data: { values: values },
        mark: { type: 'line', point: false },
        encoding: {
          x: { field: 'week', type: 'temporal', title: 'Week', axis: { labelColor: 'rgba(255,255,255,0.65)', titleColor: 'rgba(255,255,255,0.65)' } },
          y: { field: 'value', type: 'quantitative', title: yTitle, axis: { labelColor: 'rgba(255,255,255,0.65)', titleColor: 'rgba(255,255,255,0.65)' } },
          color: { field: 'series', type: 'nominal', title: 'Indicator', legend: { labelColor: 'rgba(255,255,255,0.65)', titleColor: 'rgba(255,255,255,0.65)' } },
          tooltip: [
            { field: 'week', type: 'temporal', title: 'Week' },
            { field: 'series', type: 'nominal', title: 'Indicator' },
            { field: 'value', type: 'quantitative', title: 'Value' }
          ]
        },
        config: {
          background: 'transparent',
          view: { stroke: 'rgba(255,255,255,0.08)' },
          axis: { gridColor: 'rgba(255,255,255,0.08)' }
        }
      };

      return window.vegaEmbed('#chartPublic', spec, { actions: false });
    });
  }

  function renderManager(){
    return fetchJson('./data/meta_manager.json').then(function(meta){
      setText('lastUpdatedManager', fmtDate(meta.generated_at));
      setText('mgrAlertCount', String(meta.alerts.count));
      setText('mgrAlertNote', meta.alerts.note);

      var rows = meta.alerts.items || [];
      var tbody = rows.map(function(r){
        return '<tr>'+
          '<td>' + r.level + '</td>'+
          '<td>' + r.signal + '</td>'+
          '<td>' + r.geo + '</td>'+
          '<td>' + (r.week || '') + '</td>'+
          '<td>' + r.reason + '</td>'+
        '</tr>';
      }).join('');
      var alertsBody = document.getElementById('alertsBody');
      if(alertsBody) alertsBody.innerHTML = tbody || '<tr><td colspan="5" class="small">No alerts</td></tr>';

      return fetchJson('./data/manager_timeseries.json').then(function(values){
        if(!vegaReady()) return;
        var spec = {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          width: 'container',
          height: 320,
          data: { values: values },
          mark: { type: 'line' },
          encoding: {
            x: { field: 'week', type: 'temporal', title: 'Week' },
            y: { field: 'value', type: 'quantitative', title: 'Value (not normalized)' },
            color: { field: 'series', type: 'nominal', title: 'Signal' },
            row: { field: 'domain', type: 'nominal', title: null }
          },
          config: {
            background: 'transparent',
            view: { stroke: 'rgba(255,255,255,0.08)' },
            axis: { labelColor: 'rgba(255,255,255,0.65)', titleColor: 'rgba(255,255,255,0.65)', gridColor: 'rgba(255,255,255,0.08)' },
            legend: { labelColor: 'rgba(255,255,255,0.65)', titleColor: 'rgba(255,255,255,0.65)' }
          }
        };
        return window.vegaEmbed('#chartManager', spec, { actions: false });
      });
    });
  }

  function showView(which){
    var pub = document.getElementById('viewPublic');
    var mgr = document.getElementById('viewManager');
    var btnPub = document.getElementById('btnPublic');
    var btnMgr = document.getElementById('btnManager');
    if(which === 'manager'){
      if(pub) pub.style.display='none';
      if(mgr) mgr.style.display='block';
      if(btnPub) btnPub.removeAttribute('aria-current');
      if(btnMgr) btnMgr.setAttribute('aria-current','page');
    } else {
      if(mgr) mgr.style.display='none';
      if(pub) pub.style.display='block';
      if(btnMgr) btnMgr.removeAttribute('aria-current');
      if(btnPub) btnPub.setAttribute('aria-current','page');
    }
  }

  function main(){
    // Separate KPI vs chart error handling so KPIs still show even if charts fail.
    renderKpis().then(function(){
      return renderPublicChart('resp');
    }).catch(function(e){
      setText('dataStatus', 'data: error (' + (e && e.message ? e.message : e) + ')');
    });

    // Public chart tabs
    var pubBtns = ['pubTabResp','pubTabWaste','pubTabVax'];
    var el;

    el = document.getElementById('pubTabResp');
    if(el) el.addEventListener('click', function(){
      markActive(pubBtns, 'pubTabResp');
      renderPublicChart('resp');
    });

    el = document.getElementById('pubTabWaste');
    if(el) el.addEventListener('click', function(){
      markActive(pubBtns, 'pubTabWaste');
      renderPublicChart('waste');
    });

    el = document.getElementById('pubTabVax');
    if(el) el.addEventListener('click', function(){
      markActive(pubBtns, 'pubTabVax');
      renderPublicChart('vax');
    });

    // View switching
    el = document.getElementById('btnPublic');
    if(el) el.addEventListener('click', function(){ showView('public'); });

    el = document.getElementById('btnManager');
    if(el) el.addEventListener('click', function(){
      showView('manager');
      renderManager();
    });
  }

  main();
})();
