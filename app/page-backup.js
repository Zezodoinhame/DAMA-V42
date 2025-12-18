'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';

const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

// ==================== FORMATADORES ====================
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtK = (v) => !v ? 'R$ 0' : v >= 1e12 ? 'R$ ' + (v/1e12).toFixed(2) + 'T' : v >= 1e9 ? 'R$ ' + (v/1e9).toFixed(2) + 'B' : v >= 1e6 ? 'R$ ' + (v/1e6).toFixed(2) + 'M' : v >= 1e3 ? 'R$ ' + (v/1e3).toFixed(1) + 'K' : fmt(v);
const fmtPct = (v) => v ? ((v) * 100).toFixed(2) + '%' : '0.00%';
const fmtNum = (v, d = 2) => (v || 0).toFixed(d);
const parseNum = (s) => parseFloat(String(s||'').replace(/[^\d,.-]/g,'').replace(',','.')) || 0;

// ==================== CONSTANTES ====================
const BRAPI_TOKEN = 'vYDMkbyFv3zWj47mCK8TvH';
const INDEXADORES = ['%CDI', 'CDI+', 'IPCA+', 'PRE', 'IGPM+'];

// Setores BRAPI reais
const SETORES_BRAPI = [
  'Todos', 'Finance', 'Energy Minerals', 'Utilities', 'Process Industries', 
  'Transportation', 'Retail Trade', 'Technology Services', 'Consumer Durables',
  'Health Services', 'Electronic Technology', 'Non-Energy Minerals', 
  'Producer Manufacturing', 'Communications', 'Consumer Services',
  'Distribution Services', 'Industrial Services', 'Health Technology',
  'Consumer Non-Durables', 'Commercial Services', 'Miscellaneous'
];

const SEGMENTOS_FII = [
  'Todos', 'Shoppings', 'Lajes Corporativas', 'Logística', 'Híbrido',
  'Papel', 'Fundo de Fundos', 'Residencial', 'Hotel', 'Educacional',
  'Hospital', 'Agências', 'Desenvolvimento', 'Outros'
];

// ==================== APIs BRAPI COMPLETAS ====================

// Buscar TODOS os ativos com paginação
async function fetchTodosAtivos(tipo = 'stock', pagina = 1, limite = 100, setor = '', busca = '') {
  try {
    let url = `https://brapi.dev/api/quote/list?token=${BRAPI_TOKEN}&sortBy=volume&sortOrder=desc&limit=${limite}&page=${pagina}`;
    if (setor && setor !== 'Todos') url += `&sector=${encodeURIComponent(setor)}`;
    if (busca) url += `&search=${encodeURIComponent(busca)}`;
    if (tipo === 'fii') url += `&type=fund`;
    else if (tipo === 'stock') url += `&type=stock`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    return {
      ativos: data.stocks || [],
      indices: data.indexes || [],
      setoresDisponiveis: data.availableSectors || [],
      tiposDisponiveis: data.availableStockTypes || [],
      paginaAtual: data.currentPage || 1,
      totalPaginas: data.totalPages || 1,
      totalAtivos: data.totalCount || 0,
      temProxima: data.hasNextPage || false
    };
  } catch (e) {
    console.error('Erro fetchTodosAtivos:', e);
    return { ativos: [], totalAtivos: 0, totalPaginas: 1 };
  }
}

// Cotação básica
async function fetchCotacao(ticker) {
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}?token=${BRAPI_TOKEN}&fundamental=true`);
    const data = await res.json();
    if (data.results?.[0]) {
      const r = data.results[0];
      return {
        ticker: r.symbol,
        nome: r.shortName || r.longName,
        nomeCompleto: r.longName,
        setor: r.sector || 'N/A',
        preco: r.regularMarketPrice || 0,
        variacao: r.regularMarketChangePercent || 0,
        variacaoAbs: r.regularMarketChange || 0,
        abertura: r.regularMarketOpen || 0,
        maxima: r.regularMarketDayHigh || 0,
        minima: r.regularMarketDayLow || 0,
        fechamentoAnterior: r.regularMarketPreviousClose || 0,
        volume: r.regularMarketVolume || 0,
        marketCap: r.marketCap || 0,
        max52: r.fiftyTwoWeekHigh || 0,
        min52: r.fiftyTwoWeekLow || 0,
        media200: r.twoHundredDayAverage || 0,
        pl: r.priceEarnings || 0,
        lpa: r.earningsPerShare || 0,
        pvp: r.priceToBook || 0,
        vpa: r.bookValue || 0,
        dy: r.dividendYield || 0,
        logo: r.logourl || `https://icons.brapi.dev/icons/${r.symbol}.svg`
      };
    }
  } catch (e) { console.error('Erro fetchCotacao:', e); }
  return null;
}

// Cotação ULTRA COMPLETA com todos os módulos BRAPI
async function fetchCotacaoCompleta(ticker) {
  try {
    const modules = [
      'summaryProfile',
      'financialData',
      'defaultKeyStatistics',
      'balanceSheetHistory',
      'incomeStatementHistory',
      'cashflowHistory'
    ].join(',');
    
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}?token=${BRAPI_TOKEN}&fundamental=true&dividends=true&modules=${modules}&range=1y&interval=1d`);
    const data = await res.json();
    
    if (data.results?.[0]) {
      const r = data.results[0];
      return {
        // Dados básicos
        ticker: r.symbol,
        nome: r.shortName || r.longName,
        nomeCompleto: r.longName,
        moeda: r.currency || 'BRL',
        logo: r.logourl || `https://icons.brapi.dev/icons/${r.symbol}.svg`,
        
        // Preços
        preco: r.regularMarketPrice || 0,
        variacao: r.regularMarketChangePercent || 0,
        variacaoAbs: r.regularMarketChange || 0,
        abertura: r.regularMarketOpen || 0,
        maxima: r.regularMarketDayHigh || 0,
        minima: r.regularMarketDayLow || 0,
        fechamentoAnterior: r.regularMarketPreviousClose || 0,
        horario: r.regularMarketTime,
        
        // 52 semanas
        max52: r.fiftyTwoWeekHigh || 0,
        min52: r.fiftyTwoWeekLow || 0,
        varMax52: r.fiftyTwoWeekHighChangePercent || 0,
        varMin52: r.fiftyTwoWeekLowChangePercent || 0,
        range52: r.fiftyTwoWeekRange || '',
        
        // Médias móveis
        media200: r.twoHundredDayAverage || 0,
        varMedia200: r.twoHundredDayAverageChangePercent || 0,
        
        // Volume
        volume: r.regularMarketVolume || 0,
        volumeMedio10d: r.averageDailyVolume10Day || 0,
        volumeMedio3m: r.averageDailyVolume3Month || 0,
        
        // Market Cap
        marketCap: r.marketCap || 0,
        
        // Indicadores fundamentalistas básicos
        pl: r.priceEarnings || 0,
        lpa: r.earningsPerShare || 0,
        pvp: r.priceToBook || 0,
        vpa: r.bookValue || 0,
        dy: r.dividendYield || 0,
        
        // Perfil da empresa (summaryProfile)
        perfil: r.summaryProfile ? {
          endereco: r.summaryProfile.address1,
          cidade: r.summaryProfile.city,
          estado: r.summaryProfile.state,
          pais: r.summaryProfile.country,
          telefone: r.summaryProfile.phone,
          website: r.summaryProfile.website,
          setor: r.summaryProfile.sector,
          setorKey: r.summaryProfile.sectorKey,
          industria: r.summaryProfile.industry,
          industriaKey: r.summaryProfile.industryKey,
          descricao: r.summaryProfile.longBusinessSummary,
          funcionarios: r.summaryProfile.fullTimeEmployees
        } : null,
        
        // Dados financeiros (financialData) - TTM
        financeiro: r.financialData ? {
          precoAtual: r.financialData.currentPrice,
          ebitda: r.financialData.ebitda,
          liquidezCorrente: r.financialData.currentRatio,
          liquidezSeca: r.financialData.quickRatio,
          dividaPL: r.financialData.debtToEquity,
          receitaPorAcao: r.financialData.revenuePerShare,
          roa: r.financialData.returnOnAssets,
          roe: r.financialData.returnOnEquity,
          crescimentoLucro: r.financialData.earningsGrowth,
          crescimentoReceita: r.financialData.revenueGrowth,
          margemBruta: r.financialData.grossMargins,
          margemEbitda: r.financialData.ebitdaMargins,
          margemOperacional: r.financialData.operatingMargins,
          margemLiquida: r.financialData.profitMargins,
          caixaTotal: r.financialData.totalCash,
          caixaPorAcao: r.financialData.totalCashPerShare,
          dividaTotal: r.financialData.totalDebt,
          receitaTotal: r.financialData.totalRevenue,
          lucroBruto: r.financialData.grossProfits,
          fluxoCaixaOperacional: r.financialData.operatingCashflow,
          fluxoCaixaLivre: r.financialData.freeCashflow
        } : null,
        
        // Estatísticas chave (defaultKeyStatistics)
        estatisticas: r.defaultKeyStatistics || null,
        
        // Balanço patrimonial
        balanco: r.balanceSheetHistory || [],
        
        // DRE
        dre: r.incomeStatementHistory || [],
        
        // Fluxo de caixa
        fluxoCaixa: r.cashflowHistory || [],
        
        // Dividendos
        dividendos: r.dividendsData?.cashDividends || [],
        bonificacoes: r.dividendsData?.stockDividends || [],
        
        // Histórico de preços
        historico: r.historicalDataPrice || []
      };
    }
  } catch (e) {
    console.error('Erro fetchCotacaoCompleta:', e);
  }
  return null;
}

// Histórico de preços para simulações
async function fetchHistorico(ticker, range = '10y', interval = '1mo') {
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}?token=${BRAPI_TOKEN}&range=${range}&interval=${interval}`);
    const data = await res.json();
    if (data.results?.[0]?.historicalDataPrice) {
      return data.results[0].historicalDataPrice.map(h => ({
        data: new Date(h.date * 1000).toLocaleDateString('pt-BR'),
        dataRaw: h.date,
        abertura: h.open,
        maxima: h.high,
        minima: h.low,
        fechamento: h.close,
        volume: h.volume,
        ajustado: h.adjustedClose
      }));
    }
  } catch (e) { console.error('Erro fetchHistorico:', e); }
  return [];
}

// BCB Focus completo
async function fetchBCBCompleto() {
  const r = { selic: 14.25, cdi: 14.15, ipca: 4.5, pib: 2.0, cambio: 5.8, projecoes: {} };
  try {
    const [selicRes, cdiRes] = await Promise.all([
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json'),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json')
    ]);
    const selicData = await selicRes.json();
    const cdiData = await cdiRes.json();
    if (selicData?.[0]) r.selic = parseFloat(selicData[0].valor);
    if (cdiData?.[0]) r.cdi = parseFloat(cdiData[0].valor);
    
    for (const ano of [2025, 2026, 2027, 2028, 2029, 2030]) {
      r.projecoes[ano] = { selic: r.selic, ipca: 4.5, pib: 2.0, cambio: 5.8 };
      try {
        const [fs, fi, fp, fc] = await Promise.all([
          fetch(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'Selic' and DataReferencia eq ${ano}&$top=1&$orderby=Data desc&$format=json`),
          fetch(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'IPCA' and DataReferencia eq ${ano}&$top=1&$orderby=Data desc&$format=json`),
          fetch(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'PIB Total' and DataReferencia eq ${ano}&$top=1&$orderby=Data desc&$format=json`),
          fetch(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'Câmbio' and DataReferencia eq ${ano}&$top=1&$orderby=Data desc&$format=json`)
        ]);
        const [fsd, fid, fpd, fcd] = await Promise.all([fs.json(), fi.json(), fp.json(), fc.json()]);
        if (fsd?.value?.[0]) r.projecoes[ano].selic = fsd.value[0].Mediana;
        if (fid?.value?.[0]) r.projecoes[ano].ipca = fid.value[0].Mediana;
        if (fpd?.value?.[0]) r.projecoes[ano].pib = fpd.value[0].Mediana;
        if (fcd?.value?.[0]) r.projecoes[ano].cambio = fcd.value[0].Mediana;
      } catch {}
    }
  } catch (e) { console.error('Erro BCB:', e); }
  return r;
}

// B3 em tempo real
async function fetchB3() {
  try {
    const res = await fetch('https://cotacao.b3.com.br/mds/api/v1/InstrumentPriceFluctuation/ibov');
    const data = await res.json();
    return {
      timestamp: data.Msg?.dtTm,
      altas: (data.SctyHghstIncrLst || []).slice(0, 10).map(i => ({
        ticker: i.symb,
        nome: i.desc?.trim(),
        preco: i.SctyQtn?.curPrc,
        variacao: i.SctyQtn?.prcFlcn
      })),
      baixas: (data.SctyHghstDrpLst || []).slice(0, 10).map(i => ({
        ticker: i.symb,
        nome: i.desc?.trim(),
        preco: i.SctyQtn?.curPrc,
        variacao: i.SctyQtn?.prcFlcn
      }))
    };
  } catch (e) { console.error('Erro B3:', e); }
  return { altas: [], baixas: [], timestamp: null };
}

// ==================== SIMULADORES AVANÇADOS ====================

// Simulador de rentabilidade até 30 anos
function simularRentabilidade(params) {
  const { valorInicial, aporteMensal, taxaAnual, dividendYield, anos, reinvestir } = params;
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1/12) - 1;
  const dyMensal = (dividendYield || 0) / 100 / 12;
  
  let patrimonio = valorInicial;
  let totalAportes = valorInicial;
  let totalDividendos = 0;
  const evolucao = [];
  const evolucaoMensal = [];
  
  for (let mes = 1; mes <= anos * 12; mes++) {
    // Rendimento
    const rendimento = patrimonio * taxaMensal;
    patrimonio += rendimento;
    
    // Dividendos
    const dividendo = patrimonio * dyMensal;
    totalDividendos += dividendo;
    if (reinvestir) patrimonio += dividendo;
    
    // Aporte
    patrimonio += aporteMensal;
    totalAportes += aporteMensal;
    
    // Registro mensal
    evolucaoMensal.push({
      mes,
      patrimonio: Math.round(patrimonio),
      dividendos: Math.round(totalDividendos),
      aportes: Math.round(totalAportes)
    });
    
    // Registro anual
    if (mes % 12 === 0) {
      evolucao.push({
        ano: mes / 12,
        patrimonio: Math.round(patrimonio),
        dividendos: Math.round(totalDividendos),
        aportes: Math.round(totalAportes),
        rendimento: Math.round(patrimonio - totalAportes)
      });
    }
  }
  
  return {
    patrimonioFinal: patrimonio,
    totalAportes,
    totalDividendos,
    rendimentoTotal: patrimonio - totalAportes,
    dividendoMensalFinal: patrimonio * dyMensal,
    evolucao,
    evolucaoMensal
  };
}

// Simulador de Renda Fixa completo
function simularRendaFixa(params) {
  const { valor, taxa, meses, indexador, cdi, ipca, reinvestir } = params;
  
  let taxaEfetiva;
  switch(indexador) {
    case '%CDI': taxaEfetiva = (taxa / 100) * cdi; break;
    case 'CDI+': taxaEfetiva = cdi + taxa; break;
    case 'IPCA+': taxaEfetiva = (ipca || 4.5) + taxa; break;
    case 'PRE': taxaEfetiva = taxa; break;
    case 'IGPM+': taxaEfetiva = 4.0 + taxa; break;
    default: taxaEfetiva = taxa;
  }
  
  const taxaMensal = Math.pow(1 + taxaEfetiva / 100, 1/12) - 1;
  
  let saldo = valor;
  const evolucao = [];
  
  for (let m = 1; m <= meses; m++) {
    const rendimento = saldo * taxaMensal;
    saldo += rendimento;
    
    if (m % 6 === 0 || m === meses) {
      evolucao.push({
        mes: m,
        saldo: Math.round(saldo),
        rendimento: Math.round(saldo - valor)
      });
    }
  }
  
  const rendimentoBruto = saldo - valor;
  const aliquotaIR = meses <= 6 ? 22.5 : meses <= 12 ? 20 : meses <= 24 ? 17.5 : 15;
  const impostoRenda = rendimentoBruto * aliquotaIR / 100;
  const rendimentoLiquido = rendimentoBruto - impostoRenda;
  
  return {
    montanteBruto: saldo,
    rendimentoBruto,
    aliquotaIR,
    impostoRenda,
    montanteLiquido: valor + rendimentoLiquido,
    rendimentoLiquido,
    taxaEfetiva,
    evolucao
  };
}

// Simulador FIRE completo
function simularFIRE(params) {
  const { gastoMensal, patrimonioAtual, aporteMensal, rentabilidade, tipo, idade } = params;
  
  const multiplicador = tipo === 'lean' ? 20 : tipo === 'fat' ? 33 : tipo === 'coast' ? 25 : 25;
  const meta = gastoMensal * 12 * multiplicador;
  
  if (patrimonioAtual >= meta) {
    return { meta, anos: 0, meses: 0, progresso: 100, idadeFIRE: idade, evolucao: [] };
  }
  
  const taxaMensal = Math.pow(1 + rentabilidade / 100, 1/12) - 1;
  let patrimonio = patrimonioAtual;
  let meses = 0;
  const evolucao = [];
  
  while (patrimonio < meta && meses < 600) {
    patrimonio = patrimonio * (1 + taxaMensal) + aporteMensal;
    meses++;
    
    if (meses % 12 === 0) {
      evolucao.push({
        ano: meses / 12,
        patrimonio: Math.round(patrimonio),
        meta: Math.round(meta),
        progresso: Math.min(100, (patrimonio / meta) * 100).toFixed(1)
      });
    }
  }
  
  return {
    meta,
    anos: Math.ceil(meses / 12),
    meses,
    progresso: Math.min(100, (patrimonioAtual / meta) * 100),
    idadeFIRE: idade + Math.ceil(meses / 12),
    rendaMensalFIRE: meta * 0.04 / 12,
    evolucao
  };
}

// ==================== GERADOR DE PDF PROFISSIONAL ====================

async function gerarRelatorioPDF(client, portfolio, acoes, fiis, bcb, showMsg, setGenerating) {
  setGenerating(true);
  showMsg('🔄 Iniciando geração do relatório profissional...', 'info');
  
  try {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const W = 210, H = 297, M = 12;
    let y = 0, pg = 1;
    
    const clr = {
      bg: [8, 8, 12], card: [15, 15, 22], tbl: [22, 22, 32],
      violet: [139, 92, 246], cyan: [6, 182, 212], emerald: [16, 185, 129],
      amber: [245, 158, 11], red: [239, 68, 68], white: [255, 255, 255],
      gray: [148, 163, 184], darkGray: [71, 85, 105]
    };
    
    const newPage = () => { pdf.addPage(); pg++; pdf.setFillColor(...clr.bg); pdf.rect(0,0,W,H,'F'); y = M; };
    const checkSpace = (n) => { if (y + n > H - 20) newPage(); };
    const section = (t, c = clr.violet) => { checkSpace(12); pdf.setFillColor(...c); pdf.roundedRect(M,y,5,5,1,1,'F'); pdf.setTextColor(...clr.white); pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.text(t, M+8, y+4); y += 10; };
    
    // Buscar dados completos
    showMsg('📊 Buscando dados fundamentalistas detalhados...', 'info');
    const acoesComp = [];
    for (const a of acoes) {
      showMsg(`Analisando ${a.ticker}...`, 'info');
      const d = await fetchCotacaoCompleta(a.ticker);
      if (d) acoesComp.push({...a, ...d});
      await new Promise(r => setTimeout(r, 200));
    }
    
    const fiisComp = [];
    for (const f of fiis) {
      showMsg(`Analisando ${f.ticker}...`, 'info');
      const d = await fetchCotacaoCompleta(f.ticker);
      if (d) fiisComp.push({...f, ...d});
      await new Promise(r => setTimeout(r, 200));
    }
    
    const totalRF = portfolio.reduce((s, p) => s + parseNum(p.valor), 0);
    const totalAcoes = acoes.reduce((s, a) => s + a.valorTotal, 0);
    const totalFIIs = fiis.reduce((s, f) => s + f.valorTotal, 0);
    const patrimonio = totalRF + totalAcoes + totalFIIs;
    const dataHora = new Date().toLocaleString('pt-BR');
    
    // ===== CAPA =====
    pdf.setFillColor(...clr.bg); pdf.rect(0,0,W,H,'F');
    
    // Logo
    pdf.setFillColor(...clr.violet); pdf.roundedRect(W/2-15, 25, 30, 30, 5, 5, 'F');
    pdf.setTextColor(...clr.white); pdf.setFontSize(28); pdf.setFont('helvetica','bold');
    pdf.text('D', W/2-4, 47);
    
    pdf.setFontSize(24); pdf.text('DAMA Investimentos', W/2, 75, {align:'center'});
    pdf.setFontSize(9); pdf.setTextColor(...clr.violet); pdf.text('PRIVATE BANKING', W/2, 83, {align:'center'});
    
    pdf.setDrawColor(...clr.violet); pdf.setLineWidth(0.3); pdf.line(50, 90, W-50, 90);
    
    pdf.setTextColor(...clr.white); pdf.setFontSize(22); pdf.setFont('helvetica','bold');
    pdf.text('RELATÓRIO DE ANÁLISE', W/2, 110, {align:'center'});
    pdf.text('PATRIMONIAL COMPLETO', W/2, 120, {align:'center'});
    
    pdf.setFontSize(11); pdf.setFont('helvetica','normal'); pdf.setTextColor(...clr.gray);
    pdf.text('Elaborado para:', W/2, 145, {align:'center'});
    pdf.setTextColor(...clr.white); pdf.setFontSize(16); pdf.setFont('helvetica','bold');
    pdf.text(client.nome || 'Investidor', W/2, 156, {align:'center'});
    pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor(...clr.gray);
    pdf.text(`Perfil: ${client.perfilRisco} | Horizonte: ${client.horizonte} | Idade: ${client.idade} anos`, W/2, 165, {align:'center'});
    
    // Patrimônio destaque
    pdf.setFillColor(...clr.card); pdf.roundedRect(W/2-45, 180, 90, 40, 4, 4, 'F');
    pdf.setFillColor(...clr.emerald); pdf.rect(W/2-45, 180, 90, 3, 'F');
    pdf.setTextColor(...clr.gray); pdf.setFontSize(8); pdf.text('PATRIMÔNIO TOTAL CONSOLIDADO', W/2, 194, {align:'center'});
    pdf.setTextColor(...clr.emerald); pdf.setFontSize(18); pdf.setFont('helvetica','bold');
    pdf.text(fmtK(patrimonio), W/2, 210, {align:'center'});
    
    pdf.setTextColor(...clr.darkGray); pdf.setFontSize(7); pdf.setFont('helvetica','normal');
    pdf.text(`Gerado em: ${dataHora}`, W/2, 240, {align:'center'});
    pdf.text('Fonte de dados: BRAPI Premium | Banco Central do Brasil | B3', W/2, 246, {align:'center'});
    pdf.setFontSize(6);
    pdf.text('Este relatório é informativo e não constitui recomendação de investimento.', W/2, 280, {align:'center'});
    
    // ===== PÁG 2: SUMÁRIO EXECUTIVO =====
    newPage();
    section('SUMÁRIO EXECUTIVO');
    
    // Cards
    const cw = (W - 2*M - 6) / 4;
    [[fmtK(patrimonio), 'Patrimônio Total', clr.violet], [fmtK(totalRF), 'Renda Fixa', clr.cyan], [fmtK(totalAcoes), 'Ações', clr.emerald], [fmtK(totalFIIs), 'Fundos Imob.', clr.amber]].forEach(([v, l, c], i) => {
      const x = M + i * (cw + 2);
      pdf.setFillColor(...clr.card); pdf.roundedRect(x, y, cw, 16, 2, 2, 'F');
      pdf.setFillColor(...c); pdf.rect(x, y, cw, 2, 'F');
      pdf.setTextColor(...clr.gray); pdf.setFontSize(6); pdf.text(l, x+2, y+6);
      pdf.setTextColor(...clr.white); pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.text(v, x+2, y+12);
      pdf.setFont('helvetica','normal');
    });
    y += 22;
    
    // Alocação
    section('ALOCAÇÃO DE ATIVOS');
    pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 22, 2, 2, 'F');
    const total = patrimonio || 1;
    let bx = M + 3;
    const bw = W - 2*M - 6;
    if (totalRF > 0) { const w = bw * (totalRF / total); pdf.setFillColor(...clr.cyan); pdf.roundedRect(bx, y+4, w, 6, 1, 1, 'F'); bx += w; }
    if (totalAcoes > 0) { const w = bw * (totalAcoes / total); pdf.setFillColor(...clr.emerald); pdf.rect(bx, y+4, w, 6, 'F'); bx += w; }
    if (totalFIIs > 0) { const w = bw * (totalFIIs / total); pdf.setFillColor(...clr.amber); pdf.rect(bx, y+4, w, 6, 'F'); }
    
    pdf.setFontSize(6);
    pdf.setTextColor(...clr.cyan); pdf.text(`● Renda Fixa: ${(totalRF/total*100).toFixed(1)}% (${fmtK(totalRF)})`, M+3, y+17);
    pdf.setTextColor(...clr.emerald); pdf.text(`● Ações: ${(totalAcoes/total*100).toFixed(1)}% (${fmtK(totalAcoes)})`, M+60, y+17);
    pdf.setTextColor(...clr.amber); pdf.text(`● FIIs: ${(totalFIIs/total*100).toFixed(1)}% (${fmtK(totalFIIs)})`, M+115, y+17);
    y += 28;
    
    // Cenário Macro
    section('CENÁRIO MACROECONÔMICO - BOLETIM FOCUS');
    pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 35, 2, 2, 'F');
    
    pdf.setTextColor(...clr.gray); pdf.setFontSize(6); pdf.text('INDICADORES ATUAIS', M+3, y+7);
    pdf.setTextColor(...clr.white); pdf.setFontSize(8);
    pdf.text(`SELIC: ${bcb.selic}% a.a.`, M+3, y+13);
    pdf.text(`CDI: ${bcb.cdi?.toFixed(2)}% a.a.`, M+40, y+13);
    
    pdf.setTextColor(...clr.gray); pdf.setFontSize(6); pdf.text('PROJEÇÕES DO MERCADO', M+3, y+20);
    let px = M+3;
    Object.keys(bcb.projecoes || {}).slice(0, 6).forEach(ano => {
      const p = bcb.projecoes[ano];
      pdf.setTextColor(...clr.violet); pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.text(ano, px, y+26);
      pdf.setFont('helvetica','normal'); pdf.setTextColor(...clr.white); pdf.setFontSize(5);
      pdf.text(`SELIC ${p?.selic||'-'}%`, px, y+30);
      pdf.text(`IPCA ${p?.ipca||'-'}%`, px, y+33);
      px += 30;
    });
    y += 40;
    
    // Renda Fixa
    if (portfolio.filter(p => p.produto).length > 0) {
      section('CARTEIRA DE RENDA FIXA', clr.cyan);
      pdf.autoTable({
        startY: y,
        head: [['Produto', 'Indexador', 'Taxa', 'Tributação', 'Valor Aplicado']],
        body: portfolio.filter(p => p.produto).map(p => [
          p.produto,
          p.indexador,
          p.taxa + (p.indexador === 'PRE' ? '% a.a.' : (p.indexador.includes('%') ? '% do CDI' : '% a.a.')),
          p.tributacao || 'ISENTO',
          fmt(parseNum(p.valor))
        ]),
        foot: [['', '', '', 'TOTAL', fmt(totalRF)]],
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 2, textColor: clr.white, fillColor: clr.tbl },
        headStyles: { fillColor: clr.card, textColor: clr.cyan, fontStyle: 'bold' },
        footStyles: { fillColor: clr.card, textColor: clr.cyan, fontStyle: 'bold' },
        margin: { left: M, right: M }
      });
      y = pdf.lastAutoTable.finalY + 8;
    }
    
    // ===== AÇÕES DETALHADAS =====
    if (acoesComp.length > 0) {
      newPage();
      section('ANÁLISE FUNDAMENTALISTA DE AÇÕES', clr.emerald);
      
      for (const a of acoesComp) {
        checkSpace(65);
        
        pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 58, 2, 2, 'F');
        pdf.setFillColor(...clr.emerald); pdf.rect(M, y, W-2*M, 2, 'F');
        
        // Header
        pdf.setTextColor(...clr.emerald); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
        pdf.text(a.ticker, M+3, y+9);
        pdf.setTextColor(...clr.white); pdf.setFontSize(7); pdf.setFont('helvetica','normal');
        pdf.text((a.nome || '').substring(0, 40), M+25, y+9);
        
        // Setor e indústria
        pdf.setTextColor(...clr.gray); pdf.setFontSize(5);
        pdf.text(`Setor: ${a.perfil?.setor || a.setor || 'N/A'} | Indústria: ${a.perfil?.industria || 'N/A'}`, M+3, y+14);
        
        // Preço e variação
        pdf.setTextColor(...clr.white); pdf.setFontSize(10); pdf.setFont('helvetica','bold');
        pdf.text(fmt(a.preco), W-M-35, y+9);
        const vc = (a.variacao||0) >= 0 ? clr.emerald : clr.red;
        pdf.setTextColor(...vc); pdf.setFontSize(7);
        pdf.text(`${(a.variacao||0)>=0?'+':''}${(a.variacao||0).toFixed(2)}%`, W-M-35, y+14);
        
        // Linha 1: Valuation
        let ix = M+3, iy = y+20;
        pdf.setFont('helvetica','normal');
        [
          ['P/L', fmtNum(a.pl), clr.white],
          ['P/VP', fmtNum(a.pvp), clr.white],
          ['DY', fmtNum(a.dy)+'%', clr.amber],
          ['LPA', fmt(a.lpa), clr.white],
          ['VPA', fmt(a.vpa), clr.white],
          ['Mkt Cap', fmtK(a.marketCap), clr.white]
        ].forEach(([l, v, c]) => {
          pdf.setTextColor(...clr.gray); pdf.setFontSize(5); pdf.text(l, ix, iy);
          pdf.setTextColor(...c); pdf.setFontSize(7); pdf.text(v, ix, iy+4);
          ix += 28;
        });
        
        // Linha 2: Dados financeiros
        ix = M+3; iy = y+32;
        const fin = a.financeiro || {};
        [
          ['ROE', fmtPct(fin.roe), clr.cyan],
          ['ROA', fmtPct(fin.roa), clr.cyan],
          ['Mg. Bruta', fmtPct(fin.margemBruta), clr.white],
          ['Mg. EBITDA', fmtPct(fin.margemEbitda), clr.white],
          ['Mg. Líquida', fmtPct(fin.margemLiquida), clr.white],
          ['Dív/PL', fmtNum(fin.dividaPL)+'%', (fin.dividaPL||0) > 100 ? clr.red : clr.white]
        ].forEach(([l, v, c]) => {
          pdf.setTextColor(...clr.gray); pdf.setFontSize(5); pdf.text(l, ix, iy);
          pdf.setTextColor(...c); pdf.setFontSize(7); pdf.text(v, ix, iy+4);
          ix += 28;
        });
        
        // Linha 3: Volume e 52 semanas
        ix = M+3; iy = y+44;
        [
          ['Mín 52s', fmt(a.min52), clr.red],
          ['Máx 52s', fmt(a.max52), clr.emerald],
          ['Média 200d', fmt(a.media200), clr.white],
          ['Vol. Médio', fmtK(a.volumeMedio3m || a.volume), clr.white],
          ['Qtd Carteira', String(a.quantidade), clr.white],
          ['Total Invest.', fmt(a.valorTotal), clr.emerald]
        ].forEach(([l, v, c]) => {
          pdf.setTextColor(...clr.gray); pdf.setFontSize(5); pdf.text(l, ix, iy);
          pdf.setTextColor(...c); pdf.setFontSize(7); pdf.text(v, ix, iy+4);
          ix += 28;
        });
        
        // Posição vs média
        if (a.media200 > 0) {
          const posicao = ((a.preco / a.media200 - 1) * 100).toFixed(1);
          const posColor = parseFloat(posicao) >= 0 ? clr.emerald : clr.red;
          pdf.setTextColor(...clr.gray); pdf.setFontSize(5); pdf.text('vs Média 200d:', M+3, y+54);
          pdf.setTextColor(...posColor); pdf.setFontSize(6); pdf.text(`${posicao}%`, M+28, y+54);
        }
        
        y += 62;
      }
      
      // Tabela resumo
      checkSpace(45);
      pdf.setTextColor(...clr.gray); pdf.setFontSize(7); pdf.text('RESUMO DA CARTEIRA DE AÇÕES', M, y+3);
      y += 6;
      
      pdf.autoTable({
        startY: y,
        head: [['Ticker', 'Qtd', 'Preço', 'P/L', 'P/VP', 'DY', 'LPA', 'ROE', 'Total']],
        body: acoesComp.map(a => [
          a.ticker, a.quantidade, fmt(a.preco), fmtNum(a.pl), fmtNum(a.pvp),
          fmtNum(a.dy)+'%', fmt(a.lpa), fmtPct(a.financeiro?.roe), fmt(a.valorTotal)
        ]),
        foot: [['TOTAL', acoesComp.reduce((s,a)=>s+a.quantidade,0), '', '', '', '', '', '', fmt(totalAcoes)]],
        theme: 'plain',
        styles: { fontSize: 6, cellPadding: 1.5, textColor: clr.white, fillColor: clr.tbl },
        headStyles: { fillColor: clr.card, textColor: clr.emerald, fontStyle: 'bold' },
        footStyles: { fillColor: clr.card, textColor: clr.emerald, fontStyle: 'bold' },
        margin: { left: M, right: M }
      });
      y = pdf.lastAutoTable.finalY + 8;
    }
    
    // ===== FIIs DETALHADOS =====
    if (fiisComp.length > 0) {
      newPage();
      section('ANÁLISE DE FUNDOS IMOBILIÁRIOS', clr.amber);
      
      for (const f of fiisComp) {
        checkSpace(40);
        
        pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 32, 2, 2, 'F');
        pdf.setFillColor(...clr.amber); pdf.rect(M, y, W-2*M, 2, 'F');
        
        pdf.setTextColor(...clr.amber); pdf.setFontSize(11); pdf.setFont('helvetica','bold');
        pdf.text(f.ticker, M+3, y+10);
        pdf.setTextColor(...clr.white); pdf.setFontSize(7); pdf.setFont('helvetica','normal');
        pdf.text((f.nome || '').substring(0, 35), M+30, y+10);
        
        pdf.setTextColor(...clr.white); pdf.setFontSize(10); pdf.setFont('helvetica','bold');
        pdf.text(fmt(f.preco), W-M-35, y+10);
        const vf = (f.variacao||0) >= 0 ? clr.emerald : clr.red;
        pdf.setTextColor(...vf); pdf.setFontSize(7);
        pdf.text(`${(f.variacao||0)>=0?'+':''}${(f.variacao||0).toFixed(2)}%`, W-M-35, y+15);
        
        let fx = M+3, fy = y+18;
        [
          ['DY', fmtNum(f.dy)+'%', clr.amber],
          ['P/VP', fmtNum(f.pvp), f.pvp < 1 ? clr.emerald : clr.white],
          ['Mín 52s', fmt(f.min52), clr.red],
          ['Máx 52s', fmt(f.max52), clr.emerald],
          ['Qtd', String(f.quantidade), clr.white],
          ['Total', fmt(f.valorTotal), clr.amber]
        ].forEach(([l, v, c]) => {
          pdf.setTextColor(...clr.gray); pdf.setFontSize(5); pdf.text(l, fx, fy);
          pdf.setTextColor(...c); pdf.setFontSize(7); pdf.text(v, fx, fy+5);
          fx += 30;
        });
        
        // Dividend yield mensal estimado
        const dyMensal = (f.dy || 0) / 12;
        pdf.setTextColor(...clr.gray); pdf.setFontSize(5); pdf.text('Rend. Mensal Est.:', M+3, y+30);
        pdf.setTextColor(...clr.amber); pdf.setFontSize(6); pdf.text(fmt(f.valorTotal * dyMensal / 100), M+30, y+30);
        
        y += 36;
      }
      
      // Tabela resumo FIIs
      checkSpace(40);
      pdf.autoTable({
        startY: y,
        head: [['Ticker', 'Qtd', 'Preço', 'DY', 'P/VP', 'Total', 'Rend. Mensal Est.']],
        body: fiisComp.map(f => [
          f.ticker, f.quantidade, fmt(f.preco), fmtNum(f.dy)+'%', fmtNum(f.pvp),
          fmt(f.valorTotal), fmt(f.valorTotal * (f.dy||0) / 100 / 12)
        ]),
        foot: [['TOTAL', '', '', '', '', fmt(totalFIIs), fmt(fiisComp.reduce((s,f) => s + f.valorTotal * (f.dy||0) / 100 / 12, 0))]],
        theme: 'plain',
        styles: { fontSize: 6, cellPadding: 1.5, textColor: clr.white, fillColor: clr.tbl },
        headStyles: { fillColor: clr.card, textColor: clr.amber, fontStyle: 'bold' },
        footStyles: { fillColor: clr.card, textColor: clr.amber, fontStyle: 'bold' },
        margin: { left: M, right: M }
      });
      y = pdf.lastAutoTable.finalY + 8;
    }
    
    // ===== INSIGHTS E PROJEÇÕES =====
    newPage();
    section('INSIGHTS E ANÁLISES', clr.violet);
    
    pdf.setFillColor(...clr.card); pdf.roundedRect(M, y, W-2*M, 80, 2, 2, 'F');
    
    let iy = y + 8;
    pdf.setTextColor(...clr.violet); pdf.setFontSize(8); pdf.setFont('helvetica','bold');
    pdf.text('PONTOS DE ATENÇÃO', M+3, iy);
    pdf.setFont('helvetica','normal'); iy += 6;
    
    const insights = [];
    const maxConc = Math.max(totalRF, totalAcoes, totalFIIs) / total * 100;
    if (maxConc > 60) insights.push(`⚠️ Alta concentração: ${maxConc.toFixed(0)}% em uma classe de ativos.`);
    if (maxConc < 40 && patrimonio > 0) insights.push(`✅ Boa diversificação entre classes de ativos.`);
    
    if (acoesComp.length > 0) {
      const plMedio = acoesComp.reduce((s,a) => s + (a.pl||0), 0) / acoesComp.length;
      const dyMedio = acoesComp.reduce((s,a) => s + (a.dy||0), 0) / acoesComp.length;
      const roeMedio = acoesComp.reduce((s,a) => s + (a.financeiro?.roe||0), 0) / acoesComp.length;
      
      if (plMedio > 0 && plMedio < 10) insights.push(`📊 P/L médio (${plMedio.toFixed(1)}) indica ações com valuation atrativo.`);
      if (plMedio > 20) insights.push(`📊 P/L médio (${plMedio.toFixed(1)}) elevado - avalie o crescimento esperado.`);
      if (dyMedio > 5) insights.push(`💰 DY médio das ações (${dyMedio.toFixed(1)}%) excelente para renda passiva.`);
      if (roeMedio > 0.15) insights.push(`📈 ROE médio (${(roeMedio*100).toFixed(1)}%) indica boa rentabilidade.`);
      
      const abaixoMedia = acoesComp.filter(a => a.preco < a.media200);
      if (abaixoMedia.length > 0) insights.push(`📉 ${abaixoMedia.map(a=>a.ticker).join(', ')} negociam abaixo da média 200d.`);
    }
    
    if (fiisComp.length > 0) {
      const dyFii = fiisComp.reduce((s,f) => s + (f.dy||0), 0) / fiisComp.length;
      const pvpFii = fiisComp.reduce((s,f) => s + (f.pvp||0), 0) / fiisComp.length;
      if (dyFii > 10) insights.push(`🏢 DY médio FIIs (${dyFii.toFixed(1)}%) acima da média de mercado.`);
      if (pvpFii < 0.95) insights.push(`🏢 P/VP médio (${pvpFii.toFixed(2)}) indica FIIs com desconto.`);
      if (pvpFii > 1.05) insights.push(`🏢 P/VP médio (${pvpFii.toFixed(2)}) indica FIIs com ágio.`);
    }
    
    if (bcb.selic >= 12) insights.push(`🏛️ SELIC em ${bcb.selic}% favorece alocação em renda fixa.`);
    if (insights.length === 0) insights.push('✅ Carteira bem estruturada. Continue monitorando.');
    
    pdf.setTextColor(...clr.white); pdf.setFontSize(6);
    insights.slice(0, 8).forEach(i => { pdf.text(i, M+3, iy); iy += 5; });
    
    iy += 5;
    pdf.setTextColor(...clr.emerald); pdf.setFontSize(8); pdf.setFont('helvetica','bold');
    pdf.text('PROJEÇÃO DE RENDIMENTOS (12 meses)', M+3, iy);
    pdf.setFont('helvetica','normal'); iy += 6;
    
    const rendRF = totalRF * (bcb.cdi / 100) * 0.85;
    const divAcoes = acoesComp.reduce((s,a) => s + (a.valorTotal * (a.dy||0) / 100), 0);
    const divFIIs = fiisComp.reduce((s,f) => s + (f.valorTotal * (f.dy||0) / 100), 0);
    const totalProj = rendRF + divAcoes + divFIIs;
    
    pdf.setTextColor(...clr.white); pdf.setFontSize(6);
    pdf.text(`• Renda Fixa (${bcb.cdi?.toFixed(1)}% CDI líquido): ${fmt(rendRF)}/ano`, M+3, iy); iy += 5;
    pdf.text(`• Dividendos de Ações: ${fmt(divAcoes)}/ano`, M+3, iy); iy += 5;
    pdf.text(`• Rendimentos de FIIs: ${fmt(divFIIs)}/ano`, M+3, iy); iy += 5;
    pdf.setTextColor(...clr.emerald); pdf.setFont('helvetica','bold');
    pdf.text(`• TOTAL PROJETADO: ${fmt(totalProj)}/ano (${fmt(totalProj/12)}/mês)`, M+3, iy);
    
    y += 88;
    
    // Disclaimer
    checkSpace(25);
    pdf.setFillColor(25, 25, 35); pdf.roundedRect(M, y, W-2*M, 20, 2, 2, 'F');
    pdf.setTextColor(...clr.gray); pdf.setFontSize(5);
    pdf.text('AVISO LEGAL: Este relatório tem caráter exclusivamente informativo e não constitui oferta, solicitação ou recomendação de compra', M+3, y+6);
    pdf.text('ou venda de qualquer ativo financeiro. As informações são baseadas em fontes públicas consideradas confiáveis, porém sem garantia', M+3, y+10);
    pdf.text('de exatidão ou completude. Rentabilidade passada não é garantia de rentabilidade futura. Consulte um profissional qualificado.', M+3, y+14);
    
    // Rodapé em todas as páginas
    const totalPg = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPg; i++) {
      pdf.setPage(i);
      pdf.setFillColor(...clr.card); pdf.rect(0, H-10, W, 10, 'F');
      pdf.setTextColor(...clr.darkGray); pdf.setFontSize(5);
      pdf.text('DAMA Investimentos | Dados: BRAPI Premium, BCB Focus, B3 | ' + dataHora, M, H-4);
      pdf.text(`Página ${i} de ${totalPg}`, W-M-15, H-4);
    }
    
    pdf.save(`DAMA-Relatorio-Completo-${(client.nome||'Investidor').replace(/\s/g,'-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    showMsg('✅ Relatório profissional gerado com sucesso!', 'success');
    
  } catch (e) {
    console.error('Erro PDF:', e);
    showMsg('❌ Erro ao gerar PDF: ' + e.message, 'error');
  }
  
  setGenerating(false);
}

// ==================== COMPONENTE PRINCIPAL ====================
export default function Home() {
  // Estados principais
  const [view, setView] = useState('dashboard');
  const [subView, setSubView] = useState('carteira');
  const [portfolio, setPortfolio] = useState([{ id: 1, produto: '', indexador: '%CDI', taxa: '', tributacao: 'ISENTO', valor: '' }]);
  const [client, setClient] = useState({ nome: '', idade: 30, perfilRisco: 'Moderado', horizonte: 'Longo Prazo' });
  const [acoes, setAcoes] = useState([]);
  const [fiis, setFiis] = useState([]);
  const [ticker, setTicker] = useState('');
  const [qtd, setQtd] = useState('100');
  const [bcb, setBcb] = useState({ selic: 14.25, cdi: 14.15, projecoes: {} });
  const [b3, setB3] = useState({ altas: [], baixas: [] });
  
  // Estados para lista de ativos
  const [listaAtivos, setListaAtivos] = useState({ ativos: [], totalAtivos: 0, totalPaginas: 1, paginaAtual: 1 });
  const [setorFiltro, setSetorFiltro] = useState('Todos');
  const [buscaFiltro, setBuscaFiltro] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [loading, setLoading] = useState(false);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState(SETORES_BRAPI);
  
  // Estados para calculadoras
  const [calcTab, setCalcTab] = useState('rentabilidade');
  const [calcParams, setCalcParams] = useState({
    valorInicial: 100000, aporteMensal: 2000, taxaAnual: 12, dividendYield: 6, anos: 10, reinvestir: true,
    valorRF: 50000, taxaRF: 110, mesesRF: 24, indexadorRF: '%CDI',
    gastoMensal: 5000, patrimonioAtual: 200000, aporteFIRE: 3000, rentFIRE: 10, tipoFIRE: 'tradicional', idadeFIRE: 30
  });
  const [resultado, setResultado] = useState(null);
  
  // Estados UI
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [generating, setGenerating] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ativoDetalhe, setAtivoDetalhe] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  
  // Efeitos
  useEffect(() => {
    fetchBCBCompleto().then(setBcb);
    fetchB3().then(setB3);
    const interval = setInterval(() => fetchB3().then(setB3), 60000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if ((view === 'acoes' || view === 'fiis') && subView === 'explorar') {
      carregarAtivos();
    }
  }, [view, subView, setorFiltro, paginaAtual]);
  
  // Funções
  const showMsg = useCallback((t, tp) => {
    setMsg({ text: t, type: tp || 'info' });
    setTimeout(() => setMsg({ text: '', type: '' }), 5000);
  }, []);
  
  const carregarAtivos = async () => {
    setLoading(true);
    const tipo = view === 'fiis' ? 'fii' : 'stock';
    const dados = await fetchTodosAtivos(tipo, paginaAtual, 50, setorFiltro === 'Todos' ? '' : setorFiltro, buscaFiltro);
    setListaAtivos(dados);
    if (dados.setoresDisponiveis?.length > 0) {
      setSetoresDisponiveis(['Todos', ...dados.setoresDisponiveis]);
    }
    setLoading(false);
  };
  
  const buscarAtivos = () => {
    setPaginaAtual(1);
    carregarAtivos();
  };
  
  const addRF = () => setPortfolio(p => [...p, { id: Date.now(), produto: '', indexador: '%CDI', taxa: '', tributacao: 'ISENTO', valor: '' }]);
  const updRF = (id, k, v) => setPortfolio(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const delRF = (id) => setPortfolio(p => p.length > 1 ? p.filter(x => x.id !== id) : p);
  
  const addAtivo = async (tipo) => {
    const t = ticker.toUpperCase().trim();
    if (!t) return;
    const arr = tipo === 'fii' ? fiis : acoes;
    const setArr = tipo === 'fii' ? setFiis : setAcoes;
    if (arr.find(a => a.ticker === t)) {
      showMsg(t + ' já está na carteira', 'error');
      return;
    }
    showMsg('Buscando ' + t + '...', 'info');
    const c = await fetchCotacao(t);
    if (c) {
      const q = parseInt(qtd) || 100;
      setArr(p => [...p, { ...c, quantidade: q, valorTotal: c.preco * q }]);
      setTicker('');
      setQtd('100');
      showMsg(`${t} adicionado! ${fmt(c.preco)} x ${q} = ${fmt(c.preco * q)}`, 'success');
    } else {
      showMsg('Ativo não encontrado: ' + t, 'error');
    }
  };
  
  const addDaLista = async (stock, tipo) => {
    const arr = tipo === 'fii' ? fiis : acoes;
    const setArr = tipo === 'fii' ? setFiis : setAcoes;
    if (arr.find(a => a.ticker === stock.stock)) {
      showMsg(stock.stock + ' já está na carteira', 'error');
      return;
    }
    showMsg('Adicionando ' + stock.stock + '...', 'info');
    const c = await fetchCotacao(stock.stock);
    if (c) {
      setArr(p => [...p, { ...c, quantidade: 100, valorTotal: c.preco * 100 }]);
      showMsg(stock.stock + ' adicionado!', 'success');
    }
  };
  
  const verDetalhe = async (ticker) => {
    setLoadingDetalhe(true);
    const dados = await fetchCotacaoCompleta(ticker);
    setAtivoDetalhe(dados);
    setLoadingDetalhe(false);
  };
  
  const executarCalc = () => {
    let r;
    switch(calcTab) {
      case 'rentabilidade':
        r = simularRentabilidade(calcParams);
        break;
      case 'rendafixa':
        r = simularRendaFixa({
          valor: calcParams.valorRF,
          taxa: parseFloat(calcParams.taxaRF),
          meses: calcParams.mesesRF,
          indexador: calcParams.indexadorRF,
          cdi: bcb.cdi,
          ipca: 4.5
        });
        break;
      case 'equivalencia':
        r = { equiv: (calcParams.taxaRF / (1 - 15/100)).toFixed(2) };
        break;
      case 'fire':
      case 'leanfire':
      case 'fatfire':
        r = simularFIRE({
          gastoMensal: calcParams.gastoMensal,
          patrimonioAtual: calcParams.patrimonioAtual,
          aporteMensal: calcParams.aporteFIRE,
          rentabilidade: calcParams.rentFIRE,
          tipo: calcTab === 'leanfire' ? 'lean' : calcTab === 'fatfire' ? 'fat' : 'tradicional',
          idade: calcParams.idadeFIRE
        });
        break;
    }
    setResultado(r);
  };
  
  // Cálculos
  const totalRF = portfolio.reduce((s, p) => s + parseNum(p.valor), 0);
  const totalAcoes = acoes.reduce((s, a) => s + a.valorTotal, 0);
  const totalFIIs = fiis.reduce((s, f) => s + f.valorTotal, 0);
  const patrimonio = totalRF + totalAcoes + totalFIIs;
  const pieData = [
    { name: 'Renda Fixa', value: totalRF, color: '#8b5cf6' },
    { name: 'Ações', value: totalAcoes, color: '#06b6d4' },
    { name: 'FIIs', value: totalFIIs, color: '#10b981' }
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-[#080810] text-white font-sans">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0f0f18] border-b border-[#1f1f2e] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="font-bold text-sm">D</span>
          </div>
          <span className="font-bold text-sm">DAMA</span>
        </div>
        <button onClick={() => setMobileMenu(!mobileMenu)} className="p-2 rounded-lg bg-[#1a1a28]">
          {mobileMenu ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile Menu */}
      {mobileMenu && (
        <div className="lg:hidden fixed inset-0 bg-black/80 z-40" onClick={() => setMobileMenu(false)}>
          <div className="absolute right-0 top-14 w-64 h-full bg-[#0f0f18] border-l border-[#1f1f2e] p-4" onClick={e => e.stopPropagation()}>
            <nav className="space-y-1">
              {[['dashboard','📊','Dashboard'],['carteira','💎','Renda Fixa'],['acoes','📈','Ações'],['fiis','🏢','FIIs'],['calculadoras','🧮','Calculadoras'],['fire','🔥','FIRE'],['config','⚙️','Perfil']].map(([v,i,l]) => (
                <button key={v} onClick={() => { setView(v); setSubView('carteira'); setResultado(null); setMobileMenu(false); setAtivoDetalhe(null); }} className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg text-sm ${view === v ? 'bg-violet-500/20 text-violet-400' : 'text-slate-400'}`}>
                  <span>{i}</span><span>{l}</span>
                </button>
              ))}
            </nav>
            <div className="mt-4 space-y-2">
              <a href="https://calendly.com/diego-oliveira-damainvestimentos/reuniao-de-analise" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium text-sm">
                📅 Agendar Reunião
              </a>
              <button onClick={() => { gerarRelatorioPDF(client, portfolio, acoes, fiis, bcb, showMsg, setGenerating); setMobileMenu(false); }} disabled={patrimonio === 0 || generating} className={`w-full py-3 rounded-lg font-medium text-sm ${patrimonio > 0 ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white' : 'bg-[#1a1a28] text-slate-600'}`}>
                {generating ? '⏳ Gerando...' : '📄 Relatório PRO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-52 bg-gradient-to-b from-[#0f0f18] to-[#080810] border-r border-[#1f1f2e] p-4 flex-col z-50">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="font-bold">D</span>
          </div>
          <div>
            <p className="font-bold text-sm">DAMA</p>
            <p className="text-[7px] text-violet-400 tracking-widest">INVESTIMENTOS</p>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          {[['dashboard','📊','Dashboard'],['carteira','💎','Renda Fixa'],['acoes','📈','Ações'],['fiis','🏢','FIIs'],['calculadoras','🧮','Calculadoras'],['fire','🔥','FIRE'],['config','⚙️','Perfil']].map(([v,i,l]) => (
            <button key={v} onClick={() => { setView(v); setSubView('carteira'); setResultado(null); setAtivoDetalhe(null); }} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${view === v ? 'bg-violet-500/20 text-violet-400 border-l-2 border-violet-500' : 'text-slate-400 hover:bg-white/5'}`}>
              <span>{i}</span><span>{l}</span>
            </button>
          ))}
        </nav>
        
        <div className="space-y-2 mt-4">
          <a href="https://calendly.com/diego-oliveira-damainvestimentos/reuniao-de-analise" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all">
            📅 Agendar
          </a>
          <button onClick={() => gerarRelatorioPDF(client, portfolio, acoes, fiis, bcb, showMsg, setGenerating)} disabled={patrimonio === 0 || generating} className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${patrimonio > 0 ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/20' : 'bg-[#1a1a28] text-slate-600'}`}>
            {generating ? '⏳...' : '📄 Relatório PRO'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-52 pt-16 lg:pt-0 p-4 lg:p-5 min-h-screen">
        {/* Mensagens */}
        {msg.text && (
          <div className={`mb-3 p-3 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : msg.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
            {msg.text}
          </div>
        )}

        {/* ==================== DASHBOARD ==================== */}
        {view === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Olá, {client.nome || 'Investidor'} 👋</h1>
                <p className="text-slate-400 text-xs sm:text-sm">Seu patrimônio consolidado em tempo real</p>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-[#12121a] border border-[#1f1f2e] text-xs">
                  <span className="text-slate-500">SELIC</span>
                  <span className="ml-2 font-bold text-violet-400">{bcb.selic}%</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[#12121a] border border-[#1f1f2e] text-xs">
                  <span className="text-slate-500">CDI</span>
                  <span className="ml-2 font-bold text-cyan-400">{bcb.cdi?.toFixed(2)}%</span>
                </div>
              </div>
            </div>
            
            {/* Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[['Patrimônio Total', patrimonio, 'violet', '💰'], ['Renda Fixa', totalRF, 'cyan', '💎'], ['Ações', totalAcoes, 'emerald', '📈'], ['FIIs', totalFIIs, 'amber', '🏢']].map(([l, v, c, i]) => (
                <div key={l} className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4 hover:border-violet-500/30 transition-all">
                  <div className={`w-full h-1 rounded-full bg-${c}-500 mb-3`}></div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{i}</span>
                    <span className="text-[10px] sm:text-xs text-slate-400">{l}</span>
                  </div>
                  <p className="text-base sm:text-xl font-bold">{fmtK(v)}</p>
                </div>
              ))}
            </div>
            
            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-xs text-slate-400 mb-3">Distribuição</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" stroke="none">
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[120px] flex items-center justify-center text-slate-500 text-sm">Adicione ativos</div>
                )}
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }}></div>
                      <span className="text-slate-400">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="lg:col-span-2 rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="text-xs text-slate-400 mb-3">Projeções Focus BCB</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="text-left py-1">Indicador</th>
                        {Object.keys(bcb.projecoes || {}).slice(0, 6).map(a => <th key={a} className="text-center py-1">{a}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-[#2d2d3d]">
                        <td className="py-2 text-slate-400">SELIC</td>
                        {Object.values(bcb.projecoes || {}).slice(0, 6).map((p, i) => <td key={i} className="text-center text-violet-400 font-medium">{p?.selic || '-'}%</td>)}
                      </tr>
                      <tr className="border-t border-[#2d2d3d]">
                        <td className="py-2 text-slate-400">IPCA</td>
                        {Object.values(bcb.projecoes || {}).slice(0, 6).map((p, i) => <td key={i} className="text-center text-amber-400">{p?.ipca || '-'}%</td>)}
                      </tr>
                      <tr className="border-t border-[#2d2d3d]">
                        <td className="py-2 text-slate-400">PIB</td>
                        {Object.values(bcb.projecoes || {}).slice(0, 6).map((p, i) => <td key={i} className="text-center text-emerald-400">{p?.pib || '-'}%</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* B3 Live */}
            <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  🔴 IBOVESPA
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs animate-pulse">LIVE</span>
                </h3>
                <span className="text-[10px] text-slate-500">{b3.timestamp}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-emerald-400 mb-2 font-medium">📈 Maiores Altas</p>
                  {b3.altas.slice(0, 5).map((i, x) => (
                    <div key={x} className="flex justify-between py-1.5 border-b border-[#1f1f2e] text-xs hover:bg-white/5 transition-colors">
                      <span className="font-medium">{i.ticker}</span>
                      <span className="text-emerald-400 font-medium">+{i.variacao?.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-red-400 mb-2 font-medium">📉 Maiores Baixas</p>
                  {b3.baixas.slice(0, 5).map((i, x) => (
                    <div key={x} className="flex justify-between py-1.5 border-b border-[#1f1f2e] text-xs hover:bg-white/5 transition-colors">
                      <span className="font-medium">{i.ticker}</span>
                      <span className="text-red-400 font-medium">{i.variacao?.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== RENDA FIXA ==================== */}
        {view === 'carteira' && (
          <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4 sm:p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">💎 Carteira de Renda Fixa</h2>
              <button onClick={addRF} className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 text-xs sm:text-sm hover:bg-violet-500/30 transition-colors">+ Adicionar</button>
            </div>
            
            <div className="space-y-3">
              {portfolio.map(item => (
                <div key={item.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center p-3 bg-[#1a1a28] rounded-lg border border-[#2d2d3d]">
                  <input value={item.produto} onChange={(e) => updRF(item.id, 'produto', e.target.value.toUpperCase())} placeholder="CRA VALE 2028" className="col-span-2 bg-[#12121a] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm focus:border-violet-500 outline-none" />
                  <select value={item.indexador} onChange={(e) => updRF(item.id, 'indexador', e.target.value)} className="bg-[#12121a] border border-[#2d2d3d] rounded-lg px-2 py-2 text-sm">
                    {INDEXADORES.map(i => <option key={i}>{i}</option>)}
                  </select>
                  <input value={item.taxa} onChange={(e) => updRF(item.id, 'taxa', e.target.value)} placeholder="110" className="bg-[#12121a] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm text-center" />
                  <input value={item.valor} onChange={(e) => updRF(item.id, 'valor', e.target.value)} placeholder="100.000" className="bg-[#12121a] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm text-right" />
                  <button onClick={() => delRF(item.id)} className="text-slate-500 hover:text-red-400 transition-colors justify-self-center">✕</button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-[#2d2d3d] flex justify-between items-center">
              <span className="text-slate-400 text-sm">{portfolio.filter(p => p.produto).length} produto(s)</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">Total:</span>
                <span className="text-xl font-bold text-violet-400">{fmt(totalRF)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ==================== AÇÕES E FIIs ==================== */}
        {(view === 'acoes' || view === 'fiis') && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
              <button onClick={() => { setSubView('carteira'); setAtivoDetalhe(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subView === 'carteira' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-slate-400 hover:bg-white/5'}`}>
                📋 Minha Carteira
              </button>
              <button onClick={() => { setSubView('explorar'); setAtivoDetalhe(null); setPaginaAtual(1); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subView === 'explorar' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-slate-400 hover:bg-white/5'}`}>
                🔍 Explorar Todos
              </button>
            </div>
            
            {/* Carteira */}
            {subView === 'carteira' && !ativoDetalhe && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                    {view === 'fiis' ? '🏢 Meus FIIs' : '📈 Minhas Ações'}
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      BRAPI Premium
                    </span>
                  </h2>
                </div>
                
                {/* Input adicionar */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && addAtivo(view === 'fiis' ? 'fii' : 'acao')} placeholder={view === 'fiis' ? 'Ex: HGLG11, XPLG11' : 'Ex: PETR4, VALE3, ITUB4'} className="flex-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm focus:border-violet-500 outline-none" />
                  <div className="flex gap-2">
                    <input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Qtd" className="w-24 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2.5 text-sm text-center" />
                    <button onClick={() => addAtivo(view === 'fiis' ? 'fii' : 'acao')} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg text-sm font-medium hover:from-violet-500 hover:to-purple-500 transition-all">
                      Adicionar
                    </button>
                  </div>
                </div>
                
                {/* Tabela */}
                {(view === 'acoes' ? acoes : fiis).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#1a1a28] text-slate-400 text-[10px] sm:text-xs">
                          <th className="text-left p-2 rounded-l-lg">Ticker</th>
                          <th className="text-left">Nome</th>
                          <th className="text-right">Qtd</th>
                          <th className="text-right">Preço</th>
                          <th className="text-right">Var%</th>
                          <th className="text-right">P/L</th>
                          <th className="text-right">LPA</th>
                          <th className="text-right">DY</th>
                          <th className="text-right">Total</th>
                          <th className="rounded-r-lg"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(view === 'acoes' ? acoes : fiis).map(a => (
                          <tr key={a.ticker} className="border-t border-[#2d2d3d] hover:bg-white/5 transition-colors cursor-pointer" onClick={() => verDetalhe(a.ticker)}>
                            <td className="p-2 font-bold text-cyan-400">{a.ticker}</td>
                            <td className="text-slate-300 max-w-[100px] truncate">{a.nome}</td>
                            <td className="text-right">{a.quantidade}</td>
                            <td className="text-right">{fmt(a.preco)}</td>
                            <td className={`text-right ${(a.variacao||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(a.variacao||0) >= 0 ? '+' : ''}{(a.variacao||0).toFixed(2)}%</td>
                            <td className="text-right">{fmtNum(a.pl)}</td>
                            <td className="text-right">{fmt(a.lpa)}</td>
                            <td className="text-right text-amber-400">{(a.dy||0).toFixed(2)}%</td>
                            <td className="text-right font-bold">{fmt(a.valorTotal)}</td>
                            <td>
                              <button onClick={(e) => { e.stopPropagation(); view === 'acoes' ? setAcoes(acoes.filter(x => x.ticker !== a.ticker)) : setFiis(fiis.filter(x => x.ticker !== a.ticker)); }} className="text-slate-500 hover:text-red-400 px-2">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#2d2d3d] bg-[#1a1a28]">
                          <td colSpan={8} className="p-2 text-right font-bold">TOTAL</td>
                          <td className="text-right font-bold text-cyan-400 text-base">{fmt(view === 'acoes' ? totalAcoes : totalFIIs)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-lg mb-2">Nenhum ativo na carteira</p>
                    <p className="text-sm">Digite um ticker acima ou explore todos os ativos</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Explorar */}
            {subView === 'explorar' && !ativoDetalhe && (
              <div className="space-y-4">
                {/* Filtros */}
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                  <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                    🔍 Filtrar {view === 'fiis' ? 'FIIs' : 'Ações'}
                    <span className="text-[10px] text-slate-500">({listaAtivos.totalAtivos} ativos disponíveis)</span>
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <input value={buscaFiltro} onChange={(e) => setBuscaFiltro(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && buscarAtivos()} placeholder="Buscar por ticker..." className="flex-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2 text-sm" />
                    <select value={setorFiltro} onChange={(e) => { setSetorFiltro(e.target.value); setPaginaAtual(1); }} className="bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm min-w-[150px]">
                      {setoresDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={buscarAtivos} className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30">Buscar</button>
                  </div>
                  
                  {/* Setores rápidos */}
                  <div className="flex flex-wrap gap-1.5">
                    {setoresDisponiveis.slice(0, 12).map(s => (
                      <button key={s} onClick={() => { setSetorFiltro(s); setPaginaAtual(1); }} className={`px-2 py-1 rounded text-[10px] transition-all ${setorFiltro === s ? 'bg-violet-500 text-white' : 'bg-[#1a1a28] text-slate-400 hover:bg-[#2d2d3d]'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Lista de ativos */}
                <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-sm">
                      {view === 'fiis' ? 'Fundos Imobiliários' : 'Ações'} - Ordenado por Volume
                    </h3>
                    {loading && <span className="text-xs text-slate-500 animate-pulse">Carregando...</span>}
                  </div>
                  
                  {/* Grid de ativos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {listaAtivos.ativos.map((s, i) => (
                      <div key={i} className="bg-[#1a1a28] rounded-lg p-3 border border-[#2d2d3d] hover:border-violet-500/50 transition-all cursor-pointer" onClick={() => verDetalhe(s.stock)}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {s.logo && <img src={s.logo} alt={s.stock} className="w-6 h-6 rounded" onError={(e) => e.target.style.display = 'none'} />}
                            <span className="font-bold text-cyan-400">{s.stock}</span>
                          </div>
                          <span className={`text-xs font-medium ${(s.change||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(s.change||0) >= 0 ? '+' : ''}{(s.change||0).toFixed(2)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mb-2">{s.name}</p>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{fmt(s.close || 0)}</span>
                          <span className="text-[10px] text-slate-500">{s.sector?.substring(0, 15)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500">Vol: {fmtK(s.volume)}</span>
                          <button onClick={(e) => { e.stopPropagation(); addDaLista(s, view === 'fiis' ? 'fii' : 'acao'); }} className="text-[10px] px-2 py-1 bg-violet-500/20 text-violet-400 rounded hover:bg-violet-500/30 transition-colors">
                            + Carteira
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Paginação */}
                  {listaAtivos.totalPaginas > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-[#2d2d3d]">
                      <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-3 py-1 rounded bg-[#1a1a28] text-sm disabled:opacity-50">←</button>
                      <span className="text-sm text-slate-400">Página {paginaAtual} de {listaAtivos.totalPaginas}</span>
                      <button onClick={() => setPaginaAtual(p => Math.min(listaAtivos.totalPaginas, p + 1))} disabled={!listaAtivos.temProxima} className="px-3 py-1 rounded bg-[#1a1a28] text-sm disabled:opacity-50">→</button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Detalhe do ativo */}
            {ativoDetalhe && (
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4 sm:p-5">
                <button onClick={() => setAtivoDetalhe(null)} className="mb-4 text-sm text-slate-400 hover:text-white flex items-center gap-1">
                  ← Voltar
                </button>
                
                {loadingDetalhe ? (
                  <div className="text-center py-8 text-slate-500">Carregando dados completos...</div>
                ) : (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-[#2d2d3d]">
                      <div className="flex items-center gap-3">
                        {ativoDetalhe.logo && <img src={ativoDetalhe.logo} alt={ativoDetalhe.ticker} className="w-12 h-12 rounded-lg" onError={(e) => e.target.style.display = 'none'} />}
                        <div>
                          <h2 className="text-xl font-bold text-cyan-400">{ativoDetalhe.ticker}</h2>
                          <p className="text-sm text-slate-400">{ativoDetalhe.nomeCompleto || ativoDetalhe.nome}</p>
                          <p className="text-xs text-slate-500">{ativoDetalhe.perfil?.setor} | {ativoDetalhe.perfil?.industria}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{fmt(ativoDetalhe.preco)}</p>
                        <p className={`text-sm font-medium ${(ativoDetalhe.variacao||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(ativoDetalhe.variacao||0) >= 0 ? '+' : ''}{(ativoDetalhe.variacao||0).toFixed(2)}% ({fmt(ativoDetalhe.variacaoAbs)})
                        </p>
                      </div>
                    </div>
                    
                    {/* Indicadores */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {[
                        ['P/L', fmtNum(ativoDetalhe.pl), 'violet'],
                        ['P/VP', fmtNum(ativoDetalhe.pvp), 'violet'],
                        ['DY', fmtNum(ativoDetalhe.dy) + '%', 'amber'],
                        ['LPA', fmt(ativoDetalhe.lpa), 'cyan'],
                        ['VPA', fmt(ativoDetalhe.vpa), 'cyan'],
                        ['Mkt Cap', fmtK(ativoDetalhe.marketCap), 'emerald']
                      ].map(([l, v, c]) => (
                        <div key={l} className="bg-[#1a1a28] rounded-lg p-3 border border-[#2d2d3d]">
                          <p className="text-[10px] text-slate-500">{l}</p>
                          <p className={`text-sm font-bold text-${c}-400`}>{v}</p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Dados financeiros */}
                    {ativoDetalhe.financeiro && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-400">Dados Financeiros (TTM)</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                          {[
                            ['ROE', fmtPct(ativoDetalhe.financeiro.roe), 'cyan'],
                            ['ROA', fmtPct(ativoDetalhe.financeiro.roa), 'cyan'],
                            ['Mg. Bruta', fmtPct(ativoDetalhe.financeiro.margemBruta), 'white'],
                            ['Mg. EBITDA', fmtPct(ativoDetalhe.financeiro.margemEbitda), 'white'],
                            ['Mg. Líquida', fmtPct(ativoDetalhe.financeiro.margemLiquida), 'white'],
                            ['Dív/PL', fmtNum(ativoDetalhe.financeiro.dividaPL) + '%', (ativoDetalhe.financeiro.dividaPL||0) > 100 ? 'red' : 'white'],
                            ['EBITDA', fmtK(ativoDetalhe.financeiro.ebitda), 'emerald'],
                            ['Receita', fmtK(ativoDetalhe.financeiro.receitaTotal), 'emerald'],
                            ['L. Bruto', fmtK(ativoDetalhe.financeiro.lucroBruto), 'emerald'],
                            ['FCO', fmtK(ativoDetalhe.financeiro.fluxoCaixaOperacional), 'cyan'],
                            ['FCL', fmtK(ativoDetalhe.financeiro.fluxoCaixaLivre), 'cyan'],
                            ['Caixa', fmtK(ativoDetalhe.financeiro.caixaTotal), 'amber']
                          ].map(([l, v, c]) => (
                            <div key={l} className="bg-[#1a1a28] rounded-lg p-3 border border-[#2d2d3d]">
                              <p className="text-[10px] text-slate-500">{l}</p>
                              <p className={`text-sm font-bold ${c === 'white' ? 'text-white' : `text-${c}-400`}`}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 52 semanas */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-slate-400">Range 52 Semanas</h3>
                      <div className="bg-[#1a1a28] rounded-lg p-4 border border-[#2d2d3d]">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-red-400">{fmt(ativoDetalhe.min52)}</span>
                          <span className="text-emerald-400">{fmt(ativoDetalhe.max52)}</span>
                        </div>
                        <div className="w-full bg-[#2d2d3d] rounded-full h-2 relative">
                          {ativoDetalhe.max52 > ativoDetalhe.min52 && (
                            <div className="absolute top-0 w-3 h-3 bg-cyan-400 rounded-full -mt-0.5" style={{ left: `${Math.min(100, Math.max(0, ((ativoDetalhe.preco - ativoDetalhe.min52) / (ativoDetalhe.max52 - ativoDetalhe.min52)) * 100))}%` }}></div>
                          )}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                          <span>Mínima</span>
                          <span>Preço atual: {fmt(ativoDetalhe.preco)}</span>
                          <span>Máxima</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Dividendos */}
                    {ativoDetalhe.dividendos?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-slate-400">Últimos Dividendos</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#1a1a28] text-slate-400">
                                <th className="text-left p-2">Tipo</th>
                                <th className="text-left">Data Pagto</th>
                                <th className="text-right">Valor/Ação</th>
                                <th className="text-left">Referência</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ativoDetalhe.dividendos.slice(0, 6).map((d, i) => (
                                <tr key={i} className="border-t border-[#2d2d3d]">
                                  <td className="p-2 text-amber-400">{d.label}</td>
                                  <td>{new Date(d.paymentDate).toLocaleDateString('pt-BR')}</td>
                                  <td className="text-right font-medium">{fmt(d.rate)}</td>
                                  <td className="text-slate-400">{d.relatedTo}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {/* Botão adicionar */}
                    <div className="flex gap-3 pt-4 border-t border-[#2d2d3d]">
                      <input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Quantidade" className="w-32 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm text-center" />
                      <button onClick={() => { setTicker(ativoDetalhe.ticker); addAtivo(view === 'fiis' ? 'fii' : 'acao'); setAtivoDetalhe(null); }} className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg font-medium text-sm">
                        Adicionar à Carteira ({fmt(ativoDetalhe.preco * (parseInt(qtd) || 100))})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== CALCULADORAS ==================== */}
        {view === 'calculadoras' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">🧮 Simuladores Financeiros</h2>
            
            <div className="flex flex-wrap gap-2">
              {[['rentabilidade', '💰 Rentabilidade'], ['rendafixa', '📊 Renda Fixa'], ['equivalencia', '⚖️ LCI vs CDB']].map(([k, l]) => (
                <button key={k} onClick={() => { setCalcTab(k); setResultado(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${calcTab === k ? 'bg-violet-500 text-white' : 'bg-[#1a1a28] text-slate-400 hover:bg-[#2d2d3d]'}`}>
                  {l}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Parâmetros */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="font-semibold mb-4 text-sm">Parâmetros da Simulação</h3>
                
                {calcTab === 'rentabilidade' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-slate-400">Valor Inicial</label><input type="number" value={calcParams.valorInicial} onChange={(e) => setCalcParams(p => ({...p, valorInicial: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Aporte Mensal</label><input type="number" value={calcParams.aporteMensal} onChange={(e) => setCalcParams(p => ({...p, aporteMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Taxa Anual (%)</label><input type="number" value={calcParams.taxaAnual} onChange={(e) => setCalcParams(p => ({...p, taxaAnual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Dividend Yield (%)</label><input type="number" value={calcParams.dividendYield} onChange={(e) => setCalcParams(p => ({...p, dividendYield: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Período (anos) - até 30</label><input type="number" min="1" max="30" value={calcParams.anos} onChange={(e) => setCalcParams(p => ({...p, anos: Math.min(30, +e.target.value)}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div className="flex items-center gap-2"><input type="checkbox" checked={calcParams.reinvestir} onChange={(e) => setCalcParams(p => ({...p, reinvestir: e.target.checked}))} className="w-4 h-4 rounded" /><label className="text-xs text-slate-400">Reinvestir dividendos</label></div>
                  </div>
                )}
                
                {calcTab === 'rendafixa' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-slate-400">Valor Aplicado</label><input type="number" value={calcParams.valorRF} onChange={(e) => setCalcParams(p => ({...p, valorRF: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Indexador</label><select value={calcParams.indexadorRF} onChange={(e) => setCalcParams(p => ({...p, indexadorRF: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm">{INDEXADORES.map(i => <option key={i}>{i}</option>)}</select></div>
                    <div><label className="text-xs text-slate-400">Taxa</label><input type="number" value={calcParams.taxaRF} onChange={(e) => setCalcParams(p => ({...p, taxaRF: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs text-slate-400">Prazo (meses)</label><input type="number" value={calcParams.mesesRF} onChange={(e) => setCalcParams(p => ({...p, mesesRF: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                  </div>
                )}
                
                {calcTab === 'equivalencia' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-slate-400">Taxa LCI/LCA (% do CDI)</label><input type="number" value={calcParams.taxaRF} onChange={(e) => setCalcParams(p => ({...p, taxaRF: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                    <p className="text-xs text-slate-500 mt-2">Considera alíquota de IR de 15% (prazo &gt; 2 anos)</p>
                  </div>
                )}
                
                <button onClick={executarCalc} className="w-full mt-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg font-medium text-sm hover:from-violet-500 hover:to-purple-500 transition-all">
                  Calcular
                </button>
              </div>
              
              {/* Resultado */}
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="font-semibold mb-4 text-sm">Resultado da Simulação</h3>
                
                {resultado ? (
                  <div className="space-y-4">
                    {calcTab === 'rentabilidade' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3 border border-emerald-500/30">
                            <p className="text-[10px] text-slate-400">Patrimônio Final</p>
                            <p className="text-lg font-bold text-emerald-400">{fmtK(resultado.patrimonioFinal)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3 border border-amber-500/30">
                            <p className="text-[10px] text-slate-400">Total Dividendos</p>
                            <p className="text-lg font-bold text-amber-400">{fmtK(resultado.totalDividendos)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Total Aportado</p>
                            <p className="text-sm font-bold">{fmtK(resultado.totalAportes)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Rendimento Total</p>
                            <p className="text-sm font-bold text-cyan-400">{fmtK(resultado.rendimentoTotal)}</p>
                          </div>
                        </div>
                        
                        {resultado.evolucao?.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 mb-2">Evolução Patrimonial</p>
                            <ResponsiveContainer width="100%" height={150}>
                              <AreaChart data={resultado.evolucao}>
                                <defs>
                                  <linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="ano" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} width={50} />
                                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#1a1a28', border: '1px solid #2d2d3d', borderRadius: 8, fontSize: 11 }} />
                                <Area type="monotone" dataKey="patrimonio" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorPat)" name="Patrimônio" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </>
                    )}
                    
                    {calcTab === 'rendafixa' && (
                      <>
                        <div className="bg-[#1a1a28] rounded-lg p-4 border border-cyan-500/30">
                          <p className="text-[10px] text-slate-400 mb-1">Montante Líquido</p>
                          <p className="text-2xl font-bold text-cyan-400">{fmt(resultado.montanteLiquido)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Montante Bruto</p>
                            <p className="text-sm font-bold">{fmt(resultado.montanteBruto)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Taxa Efetiva</p>
                            <p className="text-sm font-bold">{fmtNum(resultado.taxaEfetiva)}% a.a.</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">Rendimento Bruto</p>
                            <p className="text-sm font-bold text-emerald-400">{fmt(resultado.rendimentoBruto)}</p>
                          </div>
                          <div className="bg-[#1a1a28] rounded-lg p-3">
                            <p className="text-[10px] text-slate-400">IR ({resultado.aliquotaIR}%)</p>
                            <p className="text-sm font-bold text-red-400">-{fmt(resultado.impostoRenda)}</p>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {calcTab === 'equivalencia' && (
                      <div className="text-center py-6">
                        <p className="text-slate-400 text-sm mb-2">Para igualar uma LCI/LCA de {calcParams.taxaRF}% do CDI,</p>
                        <p className="text-slate-400 text-sm mb-4">você precisaria de um CDB que pague:</p>
                        <p className="text-4xl font-bold text-emerald-400">{resultado.equiv}%</p>
                        <p className="text-slate-400 text-sm mt-2">do CDI</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>Configure os parâmetros e clique em Calcular</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== FIRE ==================== */}
        {view === 'fire' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">🔥 Calculadoras FIRE</h2>
            
            <div className="flex flex-wrap gap-2">
              {[['fire', '🎯 Tradicional (25x)'], ['leanfire', '🥗 Lean (20x)'], ['fatfire', '🍰 Fat (33x)']].map(([k, l]) => (
                <button key={k} onClick={() => { setCalcTab(k); setResultado(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${calcTab === k ? 'bg-orange-500 text-white' : 'bg-[#1a1a28] text-slate-400 hover:bg-[#2d2d3d]'}`}>
                  {l}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="font-semibold mb-4 text-sm">Parâmetros FIRE</h3>
                <div className="space-y-3">
                  <div><label className="text-xs text-slate-400">Gasto Mensal Desejado</label><input type="number" value={calcParams.gastoMensal} onChange={(e) => setCalcParams(p => ({...p, gastoMensal: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-slate-400">Patrimônio Atual</label><input type="number" value={calcParams.patrimonioAtual} onChange={(e) => setCalcParams(p => ({...p, patrimonioAtual: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-slate-400">Aporte Mensal</label><input type="number" value={calcParams.aporteFIRE} onChange={(e) => setCalcParams(p => ({...p, aporteFIRE: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-slate-400">Rentabilidade Anual (%)</label><input type="number" value={calcParams.rentFIRE} onChange={(e) => setCalcParams(p => ({...p, rentFIRE: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-slate-400">Sua Idade Atual</label><input type="number" value={calcParams.idadeFIRE} onChange={(e) => setCalcParams(p => ({...p, idadeFIRE: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-3 py-2 text-sm" /></div>
                </div>
                <button onClick={executarCalc} className="w-full mt-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg font-medium text-sm">
                  Calcular FIRE
                </button>
              </div>
              
              <div className="rounded-xl bg-[#12121a] border border-[#1f1f2e] p-4">
                <h3 className="font-semibold mb-4 text-sm">Resultado FIRE</h3>
                
                {resultado ? (
                  <div className="space-y-4">
                    <div className="text-center py-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/20">
                      <p className="text-xs text-slate-400 mb-1">Meta FIRE ({calcTab === 'leanfire' ? '20x' : calcTab === 'fatfire' ? '33x' : '25x'})</p>
                      <p className="text-2xl font-bold text-orange-400">{fmtK(resultado.meta)}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#1a1a28] rounded-lg p-3">
                        <p className="text-[10px] text-slate-400">Anos para FIRE</p>
                        <p className="text-lg font-bold text-cyan-400">{resultado.anos} anos</p>
                      </div>
                      <div className="bg-[#1a1a28] rounded-lg p-3">
                        <p className="text-[10px] text-slate-400">Idade FIRE</p>
                        <p className="text-lg font-bold text-emerald-400">{resultado.idadeFIRE} anos</p>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Progresso</span>
                        <span className="text-orange-400">{resultado.progresso.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-[#1a1a28] rounded-full h-3">
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all" style={{ width: `${resultado.progresso}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-[#1a1a28] rounded-lg p-3">
                      <p className="text-[10px] text-slate-400">Renda Mensal após FIRE (4% a.a.)</p>
                      <p className="text-lg font-bold text-amber-400">{fmt(resultado.rendaMensalFIRE)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>Configure os parâmetros e calcule</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== PERFIL ==================== */}
        {view === 'config' && (
          <div className="max-w-lg mx-auto rounded-xl bg-[#12121a] border border-[#1f1f2e] p-5">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">⚙️ Perfil do Investidor</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Nome Completo</label>
                <input value={client.nome} onChange={(e) => setClient(p => ({...p, nome: e.target.value}))} placeholder="Seu nome" className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm focus:border-violet-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Idade</label>
                <input type="number" value={client.idade} onChange={(e) => setClient(p => ({...p, idade: +e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Perfil de Risco</label>
                <select value={client.perfilRisco} onChange={(e) => setClient(p => ({...p, perfilRisco: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm">
                  <option>Conservador</option>
                  <option>Moderado</option>
                  <option>Arrojado</option>
                  <option>Agressivo</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Horizonte de Investimento</label>
                <select value={client.horizonte} onChange={(e) => setClient(p => ({...p, horizonte: e.target.value}))} className="w-full mt-1 bg-[#1a1a28] border border-[#2d2d3d] rounded-lg px-4 py-2.5 text-sm">
                  <option>Curto Prazo (até 2 anos)</option>
                  <option>Médio Prazo (2-5 anos)</option>
                  <option>Longo Prazo (5+ anos)</option>
                </select>
              </div>
            </div>
            <div className="mt-5 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs text-violet-400">
              💡 Estas informações são utilizadas para personalizar o relatório PDF e as calculadoras.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
