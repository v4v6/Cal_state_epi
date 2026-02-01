(function(){
  function $(id){ return document.getElementById(id); }
  function setText(id, txt){ var el=$(id); if(el) el.textContent = txt; }

  // Status
  setText('status', 'js: running…');

  window.addEventListener('error', function(e){
    try{ setText('status', 'error: ' + (e && e.message ? e.message : String(e))); }catch(_){ }
  });

  function fetchJson(url){
    return fetch(url, {cache:'no-store'}).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  function fmtDate(iso){
    try{ return new Date(iso).toLocaleString(); }catch(_){ return iso; }
  }

  // ----- Charts (Chart.js) -----
  var lineChart = null;
  function renderLine(canvasId, series){
    if(typeof window.Chart === 'undefined'){
      setText('status', 'charts: Chart.js not loaded');
      return;
    }

    var ctx = $(canvasId).getContext('2d');
    if(lineChart) lineChart.destroy();

    // group by series name
    var by = {};
    for(var i=0;i<series.length;i++){
      var r=series[i];
      if(!by[r.series]) by[r.series]=[];
      by[r.series].push(r);
    }

    var labels = [];
    // derive labels from first series
    var firstKey = Object.keys(by)[0];
    if(firstKey){
      by[firstKey].sort(function(a,b){ return a.week < b.week ? -1 : 1; });
      labels = by[firstKey].map(function(r){ return r.week; });
    }

    var colors = ['#60a5fa','#22d3ee','#34d399','#fbbf24','#fb7185','#a78bfa'];
    var datasets = [];
    var k=0;
    Object.keys(by).forEach(function(name){
      by[name].sort(function(a,b){ return a.week < b.week ? -1 : 1; });
      datasets.push({
        label: name,
        data: by[name].map(function(r){ return r.value; }),
        borderColor: colors[k % colors.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25
      });
      k++;
    });

    lineChart = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'rgba(255,255,255,0.75)' } },
          tooltip: { enabled: true }
        },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.65)' }, grid: { color: 'rgba(255,255,255,0.08)' } },
          y: { ticks: { color: 'rgba(255,255,255,0.65)' }, grid: { color: 'rgba(255,255,255,0.08)' } }
        }
      }
    });
  }

  // ----- Map (Leaflet) -----
  var map = null;
  var geoLayer = null;
  var countyValueByFips = {};

  function colorRamp(v, max){
    if(v == null || isNaN(v)) return 'rgba(255,255,255,0.06)';
    var t = Math.min(1, v / (max || 1));
    // interpolate between cyan and blue
    var r = Math.round(34 + (96-34)*t);
    var g = Math.round(211 + (165-211)*t);
    var b = Math.round(238 + (250-238)*t);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (0.25 + 0.55*t).toFixed(2) + ')';
  }

  function renderMap(geojson, values, weekLabel){
    if(typeof window.L === 'undefined'){
      setText('status', 'map: Leaflet not loaded');
      return;
    }

    countyValueByFips = values;
    var max = 0;
    Object.keys(values).forEach(function(k){
      var v = values[k];
      if(v != null && isFinite(v)) max = Math.max(max, v);
    });

    if(!map){
      map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([37.2, -119.7], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 10,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
    }

    if(geoLayer){ geoLayer.remove(); }

    function style(feature){
      var fips = (feature.properties && (feature.properties.COUNTYFP ? ('06' + feature.properties.COUNTYFP) : feature.properties.GEOID)) || null;
      var v = fips ? values[fips] : null;
      return {
        fillColor: colorRamp(v, max),
        weight: 1,
        opacity: 1,
        color: 'rgba(255,255,255,0.18)',
        fillOpacity: 1
      };
    }

    function onEach(feature, layer){
      var name = (feature.properties && (feature.properties.NAME || feature.properties.name)) || 'County';
      var fips = (feature.properties && (feature.properties.COUNTYFP ? ('06' + feature.properties.COUNTYFP) : feature.properties.GEOID)) || null;
      var v = fips ? values[fips] : null;
      var txt = (v == null || isNaN(v)) ? 'No data' : (v.toFixed ? v.toFixed(0) : v);
      layer.bindTooltip('<b>' + name + ' County</b><br/>SARS‑CoV‑2 wastewater: ' + txt + '<br/>Week: ' + weekLabel, {sticky:true});
      layer.on({
        mouseover: function(){ layer.setStyle({weight:2, color:'rgba(255,255,255,0.35)'}); },
        mouseout: function(){ geoLayer.resetStyle(layer); }
      });
    }

    geoLayer = L.geoJSON(geojson, { style: style, onEachFeature: onEach }).addTo(map);
    setText('mapNote', 'Choropleth shows statewide coverage where wastewater reporting exists (week ' + weekLabel + ').');
  }

  // ----- App wiring -----
  var PUBLIC_TABS = ['tabDeaths','tabWaste','tabVax'];

  function markActive(ids, active){
    ids.forEach(function(id){
      var el=$(id);
      if(!el) return;
      if(id === active) el.setAttribute('aria-current','page');
      else el.removeAttribute('aria-current');
    });
  }

  function loadPublic(kind){
    if(kind === 'deaths'){
      setText('chartTitle', 'Respiratory deaths (weekly)');
      return fetchJson('./data/respiratory_deaths_state_weekly.json').then(function(series){
        renderLine('line', series);
      });
    }
    if(kind === 'waste'){
      setText('chartTitle', 'Wastewater (weekly median concentration)');
      return fetchJson('./data/wastewater_state_weekly.json').then(function(series){
        renderLine('line', series);
      });
    }
    setText('chartTitle', 'Vaccination (weekly)');
    return fetchJson('./data/vax_state_weekly.json').then(function(series){
      renderLine('line', series);
    });
  }

  function loadKpis(){
    return fetchJson('./data/meta.json').then(function(meta){
      setText('updated', fmtDate(meta.generated_at));
      setText('kpi1v', meta.kpis.respiratory.value);
      setText('kpi1n', meta.kpis.respiratory.note);
      setText('kpi2v', meta.kpis.wastewater.value);
      setText('kpi2n', meta.kpis.wastewater.note);
      setText('kpi3v', meta.kpis.hospital.value);
      setText('kpi3n', meta.kpis.hospital.note);
      setText('kpi4v', meta.kpis.vax.value);
      setText('kpi4n', meta.kpis.vax.note);
      setText('status', 'data: ok');
    });
  }

  function loadMap(){
    return Promise.all([
      fetchJson('./assets/california-counties.geojson'),
      fetchJson('./data/county_latest.json')
    ]).then(function(res){
      var geo = res[0];
      var snap = res[1];
      // build fips->value
      var values = {};
      (snap.wastewater || []).forEach(function(r){ values[r.county_fips] = r.sarscov2_wastewater_conc; });
      renderMap(geo, values, snap.wastewater_week || '—');
    });
  }

  function main(){
    // Hook events
    $('tabDeaths').addEventListener('click', function(){ markActive(PUBLIC_TABS,'tabDeaths'); loadPublic('deaths'); });
    $('tabWaste').addEventListener('click', function(){ markActive(PUBLIC_TABS,'tabWaste'); loadPublic('waste'); });
    $('tabVax').addEventListener('click', function(){ markActive(PUBLIC_TABS,'tabVax'); loadPublic('vax'); });

    // Initial load
    Promise.resolve()
      .then(loadKpis)
      .then(function(){ return loadPublic('deaths'); })
      .then(loadMap)
      .catch(function(e){ setText('status', 'error: ' + (e && e.message ? e.message : e)); });
  }

  main();
})();
