// ===== Config =====
const EMAIL_DESTINO = 'cristianzottis@fvaindustria.com.br';
// Para envio automático via Power Automate (HTTP Request trigger), preencha a URL abaixo:
const FLOW_URL = ''; // ex.: 'https://prod-XX.westus.logic.azure.com:443/workflows/...'

// ===== Utils =====
function mm3_to_cm3(mm3) { return mm3 / 1000.0; }
function area_tubo(od, parede) { const id = od - 2 * parede; return Math.PI / 4 * (od * od - id * id); }
function area_redondo(od) { return Math.PI / 4 * (od * od); }
function area_sextavado(af) { return (3 * Math.sqrt(3) / 8.0) * (af * af); }
function area_quadrado(f) { return f * f; }
function area_retangular(w, h) { return w * h; }
function parseFloatOr(v, def) { const x = parseFloat(v); return isNaN(x) ? def : x; }
function parseIntOr(v, def) { const x = parseInt(v); return isNaN(x) ? def : x; }
function qs(sel) { return document.querySelector(sel); }

// Densidade automática por material (básico)
function autoDensity(material) {
  const s = material.toLowerCase();
  if (s.includes('alum')) return 2.70;
  if (s.includes('lat') || s.includes('c360')) return 8.50;
  if (s.includes('cobre')) return 8.96;
  if (s.includes('inox') || s.includes('304') || s.includes('316')) return 7.90;
  return 7.85; // aço padrão
}

/* ===========================================================
   Suporte à imagem no link (img=...)
   -----------------------------------------------------------
   - __previewDataURL guarda uma dataURL curta (se couber no link)
   - __MAX_DATAURL_IN_LINK limita o tamanho para evitar links enormes
   =========================================================== */
let __previewDataURL = '';
const __MAX_DATAURL_IN_LINK = 1500;

// Preencher por URL (ex.: ?numCot=022/2026&codigo=ACX2077520&cliente=Nelson&img=https://... ou data:image/...)
function prefillFromURL() {
  const p = new URLSearchParams(location.search);

  ['numCot', 'codigo', 'cliente', 'qtde', 'complexidade', 'maquina', 'rph'].forEach(id => {
    if (p.has(id)) qs('#' + id).value = p.get(id);
  });

  // Suporte para imagem por URL pública ou dataURL
  if (p.has('img')) {
    try {
      const src = p.get('img');
      if (/^https?:\/\//i.test(src) || /^data:image\//i.test(src)) {
        const previewImg = qs('#previewImg');
        if (previewImg) previewImg.src = src;
      }
    } catch (e) {
      console.warn('Param img inválido:', e);
    }
  }
}

// Gera link com os campos de Dados Gerais + (opcional) imagem
function gerarLink() {
  const base = location.origin + location.pathname;
  const params = new URLSearchParams({
    numCot: qs('#numCot').value,
    codigo: qs('#codigo').value,
    cliente: qs('#cliente').value,
    qtde: qs('#qtde').value,
    complexidade: qs('#complexidade').value,
    maquina: qs('#maquina').value,
    rph: qs('#rph').value
  });

  const previewImg = qs('#previewImg');

  // Se a imagem atual é URL http(s), colocamos no link
  if (previewImg && typeof previewImg.src === 'string' && /^https?:\/\//i.test(previewImg.src)) {
    params.set('img', previewImg.src);
  }
  // Se veio de arquivo local e geramos uma dataURL curta, usamos ela
  else if (__previewDataURL && __previewDataURL.length <= __MAX_DATAURL_IN_LINK) {
    params.set('img', __previewDataURL);
  }
  // Se for arquivo local grande, não adiciona 'img' (link ficaria imenso)

  return `${base}?${params.toString()}`;
}

// Envio por e-mail/Flow do item 2 (apenas Dados Gerais + link). Anexo real requer backend/Flow.
async function enviarDadosGerais(file) {
  const link = gerarLink();
  const payload = {
    to: EMAIL_DESTINO,
    subject: `Cotação ${qs('#numCot').value || ''} - ${qs('#codigo').value || ''}`,
    message:
      `Dados Gerais:\n` +
      `- Nº cotação: ${qs('#numCot').value}\n` +
      `- Código peça: ${qs('#codigo').value}\n` +
      `- Cliente: ${qs('#cliente').value}\n` +
      `- Qtde anual: ${qs('#qtde').value}\n` +
      `- Complexidade: ${qs('#complexidade').value}\n` +
      `- Máquina: ${qs('#maquina').value}\n` +
      `- R$/h: ${qs('#rph').value}\n\n` +
      `Link para continuar a cotação (pré-preenchido):\n${link}`,
    filename: file?.name || null,
    fileBase64: file ? await fileToBase64(file) : null
  };

  if (FLOW_URL) {
    try {
      const res = await fetch(FLOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Falha no Flow');
      alert('Enviado para a engenharia com sucesso!');
      return;
    } catch (e) { console.error(e); alert('Falha ao enviar pelo Flow. Caindo no e-mail padrão...'); }
  }

  // fallback: abre e-mail com link (sem anexo por limitação de mailto)
  const mailto =
    `mailto:${encodeURIComponent(EMAIL_DESTINO)}` +
    `?subject=${encodeURIComponent(payload.subject)}` +
    `&body=${encodeURIComponent(payload.message)}`;
  location.href = mailto;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Ferramentas tabela
function getFerramentas(rph) {
  const rows = [...document.querySelectorAll('#tblFerr tbody tr')];
  const list = [];
  rows.forEach(tr => {
    const usar = tr.children[0].querySelector('input').checked;
    const nome = tr.children[1].textContent.trim();
    const preco = parseFloatOr(tr.children[2].querySelector('input').value, 0);
    const arestas = parseFloatOr(tr.children[3].querySelector('input').value, 1);
    const pcsPorAresta = parseFloatOr(tr.children[4].querySelector('input').value, 1);
    const troca = parseFloatOr(tr.children[5].querySelector('input').value, 0);
    const rphTrocaVal = tr.children[6].querySelector('input').value.trim();
    const rphTroca = rphTrocaVal ? parseFloatOr(rphTrocaVal, rph) : rph;
    if (usar) {
      const desgaste = preco / (arestas * pcsPorAresta);
      const trocaPc = (troca / 3600.0) * rphTroca / pcsPorAresta;
      list.push({ nome, desgaste, trocaPc, total: desgaste + trocaPc });
    }
  });
  return list;
}

function addFerrRow() {
  const tbody = document.querySelector('#tblFerr tbody');
  const tr = document.createElement('tr');
  tr.innerHTML =
    `<td><input type="checkbox"/></td>` +
    `<td>Ferramenta</td>` +
    `<td><input type="number" step="0.01"/></td>` +
    `<td><input type="number" step="1" value="1"/></td>` +
    `<td><input type="number" step="1" value="1000"/></td>` +
    `<td><input type="number" step="1" value="60"/></td>` +
    `<td><input type="number" step="0.01"/></td>`;
  tbody.appendChild(tr);
}

// Cálculo principal (mesmo modelo, com peso bruto/líquido e densidade auto)
document.addEventListener('DOMContentLoaded', () => {
  prefillFromURL();

  document.getElementById('addFerr').addEventListener('click', addFerrRow);

  // Preview do desenho
  const fileInput = qs('#desenho');
  const previewImg = qs('#previewImg');

  fileInput.addEventListener('change', () => {
    __previewDataURL = ''; // reseta cache da dataURL
    const f = fileInput.files[0] || null;
    if (!f) { previewImg.src = ''; return; }

    if (f.type.startsWith('image/')) {
      // Prévia imediata com blob URL
      const url = URL.createObjectURL(f);
      previewImg.src = url;

      // Também tenta gerar dataURL (para embutir em link se couber)
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = r.result; // "data:image/...;base64,...."
        if (typeof dataUrl === 'string' && dataUrl.length <= __MAX_DATAURL_IN_LINK) {
          __previewDataURL = dataUrl;
        } else {
          __previewDataURL = '';
        }
      };
      r.readAsDataURL(f);
    } else {
      // pdf/outros: não há prévia <img>
      previewImg.src = '';
    }
  });

  // Botões de envio/link
  qs('#btnLink').addEventListener('click', () => {
    const link = gerarLink();
    alert('Link gerado:\n' + link);
  });

  qs('#btnCopiar').addEventListener('click', async () => {
    const link = gerarLink();
    try {
      await navigator.clipboard.writeText(link);
      alert('Link copiado para a área de transferência');
    } catch {
      prompt('Copie manualmente o link:', link);
    }
  });

  qs('#btnEnviar').addEventListener('click', () => {
    const f = fileInput.files[0] || null;
    enviarDadosGerais(f);
  });

  // Auto densidade quando mudar material
  qs('#material').addEventListener('input', () => {
    const d = autoDensity(qs('#material').value);
    qs('#dens').value = d.toFixed(2);
    // não mexe na imagem aqui
  });

  // Botão calcular custos
  document.getElementById('calc').addEventListener('click', () => {
    calcular();
  });
});

function calcular() {
  const material = qs('#material').value.trim();
  const formato = qs('#formato').value;
  const od = parseFloatOr(qs('#od').value, 0);
  const parede = parseFloatOr(qs('#parede').value, 0);
  const altura = parseFloatOr(qs('#altura').value, 0);
  const dens = parseFloatOr(qs('#dens').value, autoDensity(material));
  const precoKg = parseFloatOr(qs('#precoKg').value, 0);
  const compPeca = parseFloatOr(qs('#compPeca').value, 0);
  const sobra = parseFloatOr(qs('#sobra').value, 0);
  const barraUtil = parseFloatOr(qs('#barraUtil').value, 2850);
  const perdaCavaco = parseFloatOr(qs('#perdaCavaco').value, 0);
  const usaSucata = qs('#usaSucata').value === 'sim';
  const precoSucata = parseFloatOr(qs('#precoSucata').value, 0);
  const rph = parseFloatOr(qs('#rph').value, 120);
  const ciclo = parseFloatOr(qs('#ciclo').value, 35);
  const setupH = parseFloatOr(qs('#setupH').value, 0);
  const setupRph = parseFloatOr(qs('#setupRph').value, rph);
  const setupTipo = qs('#setupTipo').value;
  const tamLote = parseIntOr(qs('#tamLote').value, parseIntOr(qs('#qtde').value, 1));
  const rev = parseFloatOr(qs('#rev').value, 0);
  const esc = parseFloatOr(qs('#esc').value, 0);
  const cont = parseFloatOr(qs('#cont').value, 0);
  const emb = parseFloatOr(qs('#emb').value, 0);

  // Área seção
  let area;
  if (formato === 'tubo') area = area_tubo(od, parede);
  else if (formato === 'redondo') area = area_redondo(od);
  else if (formato === 'sextavado') area = area_sextavado(od);
  else if (formato === 'quadrado') area = area_quadrado(od);
  else if (formato === 'retangular') area = area_retangular(od, altura);
  else area = 0;

  const compPorPeca = compPeca + sobra;
  const vol_mm3 = area * compPorPeca;
  const vol_cm3 = mm3_to_cm3(vol_mm3);
  const massa_kg = vol_cm3 * (dens / 1000.0);
  qs('#pesoBruto').value = massa_kg.toFixed(4);

  const remG = parseFloatOr(qs('#remocaoG').value, 0);
  const peso_liquido = Math.max(0, massa_kg - (remG / 1000.0));
  qs('#pesoLiquido').value = peso_liquido.toFixed(4);

  // Material com perda (somente latão)
  const isLatao = material.toLowerCase().includes('lat') || material.toLowerCase().includes('c360');
  const perdaFactor = (isLatao ? (1 + (perdaCavaco / 100.0)) : 1.0);
  const massa_efetiva_kg = massa_kg * perdaFactor;
  const custo_material_pc = massa_efetiva_kg * precoKg;
  const credito_sucata_pc = usaSucata ? (massa_kg * precoSucata) : 0.0;

  // Yield
  const pcs_por_barra = Math.floor(barraUtil / compPorPeca);
  const qtde = parseIntOr(qs('#qtde').value, 1);
  const barras_por_ano = Math.ceil(qtde / Math.max(pcs_por_barra, 1));

  // Máquina
  const custo_maquina_pc = rph * (ciclo / 3600.0);

  // Setup por ano/lote
  const custo_setup_total = setupH * setupRph;
  const divisor_setup = (setupTipo === 'ano') ? qtde : Math.max(tamLote, 1);
  const custo_setup_pc = custo_setup_total / divisor_setup;

  // Manuais
  const custo_manuais_pc = rev + esc + cont + emb;

  // Ferramentas
  const ferrList = getFerramentas(rph);
  const custo_ferr_pc = ferrList.reduce((acc, x) => acc + x.total, 0.0);

  // Tratamento (placeholder: sem tela aqui)
  const custo_trat_pc = 0.0;

  const total_pc = custo_material_pc + custo_maquina_pc + custo_setup_pc + custo_manuais_pc + custo_ferr_pc + custo_trat_pc - credito_sucata_pc;
  const total_anual = total_pc * qtde;

  // Render KPIs
  const kpisDiv = document.getElementById('kpis');
  kpisDiv.innerHTML = `
    <p><strong>Nº cotação:</strong> ${qs('#numCot').value}</p>
    <p><strong>Comprimento por peça:</strong> ${compPorPeca.toFixed(2)} mm</p>
    <p><strong>Área seção:</strong> ${area.toFixed(1)} mm²</p>
    <p><strong>Peso bruto por peça:</strong> ${massa_kg.toFixed(4)} kg 
    <strong>Peso líquido:</strong> ${peso_liquido.toFixed(4)} kg</p>
    <p><strong>Peças por barra (${barraUtil} mm):</strong> ${pcs_por_barra}</p>
    <p><strong>Barras necessárias/ano:</strong> ${barras_por_ano}</p>
    <p><strong>Custo unitário:</strong> R$ ${total_pc.toFixed(2)}</p>
    <p><strong>Custo anual:</strong> R$ ${total_anual.toFixed(2)}</p>
  `;

  const resumoDiv = document.getElementById('resumo');
  resumoDiv.innerHTML = `
    <ul>
      <li>Material: R$ ${custo_material_pc.toFixed(2)}</li>
      <li>Usinagem (máquina): R$ ${custo_maquina_pc.toFixed(2)}</li>
      <li>Setup diluído: R$ ${custo_setup_pc.toFixed(2)}</li>
      <li>Operações manuais: R$ ${custo_manuais_pc.toFixed(3)}</li>
      <li>Ferramentas: R$ ${custo_ferr_pc.toFixed(3)}</li>
      <li>Tratamento: R$ ${custo_trat_pc.toFixed(3)}</li>
      <li>Crédito de sucata: R$ ${credito_sucata_pc.toFixed(3)}</li>
    </ul>
  `;

  const cenDiv = document.getElementById('cenarios');
  const tempos = [25, 30, 35, 45];
  let html = '<table class="table"><thead><tr><th>Ciclo (s)</th><th>Máquina (R$/pc)</th><th>Ferramentas</th><th>Tratamento</th><th>Total (R$/pc)</th></tr></thead><tbody>';
  tempos.forEach(t => {
    const m = rph * (t / 3600.0);
    const tot = custo_material_pc + m + custo_setup_pc + custo_manuais_pc + custo_ferr_pc + custo_trat_pc - credito_sucata_pc;
    html += `<tr><td>${t}</td><td>${m.toFixed(2)}</td><td>${custo_ferr_pc.toFixed(3)}</td><td>${custo_trat_pc.toFixed(3)}</td><td><strong>${tot.toFixed(2)}</strong></td></tr>`;
  });
  html += '</tbody></table>';
  cenDiv.innerHTML = html;

  document.getElementById('resultado').style.display = 'block';
}

// Export JSON
function toJSON() {
  const out = {
    meta: { app: 'Orçamentação Usinagem MVP', version: '3.0' },
    timestamp: new Date().toISOString(),
    numCot: qs('#numCot').value,
    dadosGerais: {
      codigo: qs('#codigo').value,
      cliente: qs('#cliente').value,
      qtde: qs('#qtde').value,
      complexidade: qs('#complexidade').value,
      maquina: qs('#maquina').value,
      rph: qs('#rph').value
    }
  };
  return JSON.stringify(out, null, 2);
}
document.getElementById('exportJson').addEventListener('click', () => {
  const data = toJSON();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'orcamento.json'; a.click(); URL.revokeObjectURL(url);
});
