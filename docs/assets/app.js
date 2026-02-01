// Minimal runtime diagnostics (helps when users report "no data")
window.addEventListener('error', (e) => {
  try {
    const msg = e?.error?.message || e?.message || String(e);
    const el = document.getElementById('dataStatus');
    if (el) el.textContent = `error: ${msg}`;
  } catch {}
});

async function fetchJson(path){
  const r = await fetch(path, {cache: 'no-store'});
  if(!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
  return r.json();
}

function fmtDate(iso){
  try{ return new Date(iso).toLocaleString(); }catch{ return iso; }
}

function setText(id, text){
  const el = document.getElementById(id);
  if(el) el.textContent = text;
}

function markActive(btnIds, activeId){
  for(const id of btnIds){
    const el = document.getElementById(id);
    if(!el) continue;
    if(id === activeId) el.setAttribute('aria-current','page');
    else el.removeAttribute('aria-current');
  }
}

async function renderKpis(){
  const meta = await fetchJson('./data/meta.json');
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
}

async function renderPublicChart(kind){
  const noteEl = document.getElementById('publicChartNote');

  let dataPath = null;
  let title = '';
  let yTitle = '';
  if(kind === 'resp'){
    dataPath = './data/respiratory_deaths_state_weekly.json';
    title = 'Deaths (weekly) — statewide';
    yTitle = 'Deaths';
    noteEl.textContent = 'Source: Respiratory Virus Dashboard Metrics (Deaths).';
  } else if(kind === 'waste'){
    dataPath = './data/wastewater_state_weekly.json';
    title = 'Wastewater concentration (weekly median) — statewide';
    yTitle = 'PCR target avg concentration (median)';
    noteEl.textContent = 'Source: Wastewater Surveillance California (pcr_target_avg_conc).';
  } else {
    dataPath = './data/vax_state_weekly.json';
    title = 'Vaccination (weekly) — statewide';
    yTitle = 'Count';
    noteEl.textContent = 'Source: Vaccine Progress Dashboard (administered doses & up-to-date counts).';
  }

  const values = await fetchJson(dataPath);
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 'container',
    height: 320,
    title: { text: title, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700 },
    data: { values },
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

  await vegaEmbed('#chartPublic', spec, { actions: false });
}

async function renderManager(){
  const meta = await fetchJson('./data/meta_manager.json');
  setText('lastUpdatedManager', fmtDate(meta.generated_at));
  setText('mgrAlertCount', String(meta.alerts.count));
  setText('mgrAlertNote', meta.alerts.note);

  const rows = meta.alerts.items || [];
  const tbody = rows.map(r => `
    <tr>
      <td>${r.level}</td>
      <td>${r.signal}</td>
      <td>${r.geo}</td>
      <td>${r.week || ''}</td>
      <td>${r.reason}</td>
    </tr>
  `).join('');
  document.getElementById('alertsBody').innerHTML = tbody || '<tr><td colspan="5" class="small">No alerts</td></tr>';

  const values = await fetchJson('./data/manager_timeseries.json');
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 'container',
    height: 320,
    data: { values },
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
  await vegaEmbed('#chartManager', spec, { actions: false });
}

function showView(which){
  const pub = document.getElementById('viewPublic');
  const mgr = document.getElementById('viewManager');
  const btnPub = document.getElementById('btnPublic');
  const btnMgr = document.getElementById('btnManager');
  if(which === 'manager'){
    pub.style.display='none';
    mgr.style.display='block';
    btnPub.removeAttribute('aria-current');
    btnMgr.setAttribute('aria-current','page');
  } else {
    mgr.style.display='none';
    pub.style.display='block';
    btnMgr.removeAttribute('aria-current');
    btnPub.setAttribute('aria-current','page');
  }
}

async function main(){
  // Prove JS is running even before data loads.
  setText('dataStatus', 'js: running…');

  try{
    await renderKpis();
    await renderPublicChart('resp');
  } catch (e){
    console.error(e);
    setText('dataStatus', `data: error (${e?.message || e})`);
  }

  // public chart tabs
  const pubBtns = ['pubTabResp','pubTabWaste','pubTabVax'];
  document.getElementById('pubTabResp').addEventListener('click', async () => {
    markActive(pubBtns, 'pubTabResp');
    await renderPublicChart('resp');
  });
  document.getElementById('pubTabWaste').addEventListener('click', async () => {
    markActive(pubBtns, 'pubTabWaste');
    await renderPublicChart('waste');
  });
  document.getElementById('pubTabVax').addEventListener('click', async () => {
    markActive(pubBtns, 'pubTabVax');
    await renderPublicChart('vax');
  });

  // view switching
  document.getElementById('btnPublic').addEventListener('click', () => showView('public'));
  document.getElementById('btnManager').addEventListener('click', async () => {
    showView('manager');
    await renderManager();
  });
}

main();
