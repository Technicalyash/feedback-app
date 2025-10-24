/* main.js - form logic + dashboard D3 visuals */

// ---------- Helpers ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function showToast(msg, success=true){
  const t = $('#toast');
  t.textContent = msg;
  t.style.background = success ? 'rgba(6,182,212,0.08)' : 'rgba(255,80,80,0.06)';
  t.classList.remove('hidden');
  setTimeout(()=> t.classList.add('hidden'), 3800);
}

// ---------- Star rating ----------
let rating = 3;
const starButtons = document.querySelectorAll('.stars button');
starButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    rating = Number(btn.dataset.value);
    starButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.value) <= rating));
  });
  btn.addEventListener('mouseover', () => {
    starButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.value) <= Number(btn.dataset.value)));
  });
  btn.addEventListener('mouseout', () => {
    starButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.value) <= rating));
  });
});

// ---------- Form submit ----------
const form = $('#feedbackForm');
const spinner = $('#spinner');
const submitBtn = $('#submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  spinner.classList.remove('hidden');
  submitBtn.disabled = true;

  const data = {
    name: $('#name').value || 'Anonymous',
    email: $('#email').value || '',
    feedback: $('#feedback').value,
    rating
  };

  try {
    const res = await fetch('/submit', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if(res.ok){
      showToast(`Saved • Sentiment: ${body.sentiment} • Emotion: ${body.emotion}`);
      $('#feedback').value = '';
      rating = 3;
      starButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.value) <= rating));
      // immediate UI update
      await updateAllVisuals();
    } else {
      showToast(body.message || 'Error saving', false);
    }
  } catch(err){
    console.error(err);
    showToast('Network error', false);
  } finally {
    spinner.classList.add('hidden');
    submitBtn.disabled = false;
  }
});

// ---------- Feedback cards reload ----------
async function loadFeedbackCards(targetId = '#feedbackCards'){
  const container = document.querySelector(targetId);
  if(!container) return;
  const res = await fetch('/get_feedback');
  const data = await res.json();
  container.innerHTML = '';
  data.forEach(d => {
    const div = document.createElement('div');
    div.className = 'feedback-card';
    const created = new Date(d.created_at || d._id?.$date || Date.now()).toLocaleString();
    div.innerHTML = `<div style="display:flex;justify-content:space-between">
        <strong>${d.name || 'Anonymous'}</strong>
        <div class="meta">${(d.rating||0)}⭐ • ${d.sentiment_label||d.sentiment||'N/A'}</div>
      </div>
      <div class="meta" style="margin-top:8px">${(d.feedback||'').slice(0,200)}</div>
      <div class="meta" style="margin-top:8px;color:var(--muted)"> ${created} • ${d.emotion||''} ${d.keywords ? '• '+(d.keywords.slice(0,3).join(', ')) : ''}</div>`;
    container.appendChild(div);
  });
}

// ---------- D3: Sentiment bars ----------
async function drawSentimentBars(){
  const el = d3.select('#sentimentBars');
  el.selectAll('*').remove();
  const w = 520, h = 120, margin = {l:30,r:20,t:10,b:30};
  const svg = el.append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${margin.l},${margin.t})`);
  const innerW = w - margin.l - margin.r, innerH = h - margin.t - margin.b;

  // placeholder bars with transition
  const res = await fetch('/get_feedback_counts');
  const stats = await res.json();
  const data = [
    {k:'Positive', v: stats.positive || 0, color:'#4CAF50'},
    {k:'Neutral',  v: stats.neutral  || 0, color:'#FFC107'},
    {k:'Negative', v: stats.negative || 0, color:'#F44336'}
  ];

  const x = d3.scaleBand().domain(data.map(d=>d.k)).range([0, innerW]).padding(0.35);
  const yMax = d3.max(data, d=>d.v) || 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

  g.append('g').call(d3.axisLeft(y).ticks(3)).selectAll('text').attr('fill','#9aa6bf');
  g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x)).selectAll('text').attr('fill','#fff');

  const bars = g.selectAll('.bar').data(data).enter()
    .append('rect')
    .attr('class','bar')
    .attr('x', d=>x(d.k))
    .attr('y', innerH)
    .attr('width', x.bandwidth())
    .attr('height', 0)
    .attr('fill', d=>d.color)
    .style('rx',6)
    .on('mouseover', function(e,d){
      d3.select(this).attr('opacity',0.85).attr('transform','scale(1.02)');
    })
    .on('mouseout', function(){ d3.select(this).attr('opacity',1).attr('transform','scale(1)'); });

  // animate
  bars.transition().duration(900).attr('y', d=>y(d.v)).attr('height', d=> innerH - y(d.v)).delay((d,i)=>i*120);

  // numbers on top
  g.selectAll('.label').data(data).enter()
    .append('text')
    .attr('x', d=> x(d.k) + x.bandwidth()/2)
    .attr('y', d=> y(d.v) - 8)
    .attr('text-anchor','middle')
    .attr('fill','#fff')
    .style('font-weight','600')
    .text(d=>d.v);
}

// ---------- D3: Emotion radial chart ----------
async function drawEmotionRadial(){
  const res = await fetch('/get_emotion_counts');
  const counts = await res.json(); // object {joy:10, anger:2,...}
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const svg = d3.select('#emotionChart');
  svg.selectAll('*').remove();
  const width = +svg.attr('width'), height = +svg.attr('height'), radius = Math.min(width,height)/2 - 10;
  const g = svg.append('g').attr('transform', `translate(${width/2},${height/2})`);

  const pie = d3.pie().value(d=>d[1]);
  const arc = d3.arc().innerRadius(radius*0.35).outerRadius(d=> radius * (0.5 + 0.4 * (d.data[1] / (entries[0] ? entries[0][1] : 1)) ));
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const arcs = g.selectAll('.arc').data(pie(entries)).enter().append('g').attr('class','arc');
  arcs.append('path').attr('d', arc).attr('fill', (d,i)=>color(i)).attr('opacity',0.95)
    .on('mouseover', (e,d)=> {
      const label = `${d.data[0]} • ${d.data[1]}`;
      showTempLabel(label);
    });

  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('text-anchor','middle')
    .attr('fill','#fff')
    .style('font-size','11px')
    .text(d=>d.data[0].slice(0,6));
}

function showTempLabel(text){
  let el = document.getElementById('tempLabel');
  if(!el){
    el = document.createElement('div');
    el.id = 'tempLabel';
    el.style.position='fixed';
    el.style.right='24px';
    el.style.top='100px';
    el.style.padding='8px 12px';
    el.style.background='rgba(0,0,0,0.5)';
    el.style.color='#fff';
    el.style.borderRadius='8px';
    el.style.zIndex=9999;
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  setTimeout(()=> el.style.opacity = '0', 1600);
}

// ---------- D3: Word cloud ----------
async function drawWordCloud(){
  const res = await fetch('/get_top_keywords');
  const list = await res.json(); // [{keyword,count},...]
  const words = list.map(d => ({text:d.keyword, size: 10 + Math.log(1+d.count)*14}));

  d3.select('#wordCloud').selectAll('*').remove();
  const width = document.querySelector('.wordcloud').clientWidth;
  const height = 220;
  const layout = d3.layout.cloud().size([width, height])
    .words(words)
    .padding(4)
    .rotate(()=> ~~(Math.random()*2)*90)
    .font('Impact')
    .fontSize(d => d.size)
    .on('end', draw);

  layout.start();

  function draw(words) {
    const svg = d3.select('#wordCloud').append('svg').attr('width', width).attr('height', height);
    svg.append('g').attr('transform', `translate(${width/2},${height/2})`)
      .selectAll('text').data(words).enter().append('text')
      .style('font-size', d=>d.size + 'px')
      .style('fill', (d,i)=> d3.interpolateCool(i/words.length))
      .attr('text-anchor','middle')
      .attr('transform', d=>`translate(${d.x},${d.y})rotate(${d.rotate})`)
      .text(d=>d.text)
      .on('mouseover', (e,d) => showTempLabel(`${d.text}`));
  }
}

// ---------- update all visuals & cards ----------
async function updateAllVisuals(){
  await Promise.all([
    drawSentimentBars(),
    drawEmotionRadial(),
    drawWordCloud(),
    loadFeedbackCards('#feedbackCards'),
    loadFeedbackCards('#feedbackCardsDash')
  ]);
}

// initial load + polling
updateAllVisuals();
setInterval(updateAllVisuals, 5000);
