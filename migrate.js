'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Client } = require('pg');

const CSV_DIR = process.env.CSV_DIR || path.join(__dirname, 'csv');
const PGSCHEMA = process.env.PGSCHEMA || 'catalogo_automacao';

const warnings = [];
function warn(msg) {
  warnings.push(msg);
}

/**
 * Normalize empty/nan/null/n/a strings to null.
 */
function normNull(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (/^(nan|null|n\/a|none|undefined)$/i.test(s)) return null;
  return s;
}

/**
 * Convert Excel/Google Sheets serial dates (e.g. 46352) or DD/MM/YYYY to ISO YYYY-MM-DD.
 */
function parseDate(val, fallback = null, context = '') {
  const s = normNull(val);
  if (!s) {
    if (fallback) {
      warn(`[DATE] ${context}: data vazia substituída por fallback (${fallback})`);
      return fallback;
    }
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial >= 20000 && serial <= 70000) {
      const utcMs = Date.UTC(1899, 11, 30) + serial * 86400000;
      const iso = new Date(utcMs).toISOString().slice(0, 10);
      warn(`[DATE] ${context}: serial numérico "${s}" convertido para "${iso}"`);
      return iso;
    }
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  warn(`[DATE] ${context}: formato não reconhecido "${s}", usando fallback (${fallback})`);
  return fallback;
}

/**
 * Recover decimal values accidentally auto-formatted as dates by Google Sheets (e.g., 2.2 -> 2026-02-02)
 * when the attribute unit is numeric/physical and not a date.
 */
function sanitizeAttrValue(val, context = '') {
  const s = normNull(val);
  if (!s) return null;
  const isoMatch = s.match(/^20\d{2}-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const recovered = `${Number(isoMatch[2])}.${Number(isoMatch[1])}`;
    warn(`[SHEETS-DATE-DECIMAL] ${context}: "${s}" recuperado para "${recovered}"`);
    return recovered;
  }
  return s;
}

/**
 * Extract numeric value for NUMERIC(18,6) when the string represents a single number.
 */
function extractNumeric(val) {
  const s = normNull(val);
  if (!s) return null;
  const normalized = s.replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const num = Number(normalized);
  if (!Number.isFinite(num) || Math.abs(num) >= 1e12) return null;
  return Number(num.toFixed(6));
}

function loadCsv(tabName) {
  const files = fs.readdirSync(CSV_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  const pattern = tabName.toUpperCase();
  const matches = files.filter((f) => {
    const upper = f.toUpperCase();
    return (upper.includes(`- ${pattern}.CSV`) || upper === `${pattern}.CSV` || upper.includes(pattern))
      && !/\(\d+\)\.csv$/i.test(f);
  });
  const file = matches[0] || files.find((f) => f.toUpperCase().includes(pattern));
  if (!file) {
    warn(`[CSV] Arquivo para aba "${tabName}" não encontrado em ${CSV_DIR} (ignorado).`);
    return [];
  }
  const raw = fs.readFileSync(path.join(CSV_DIR, file), 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true, trim: true });
}

function prepareDataset() {
  const fabRows = loadCsv('FABRICANTES');
  const catRows = loadCsv('CATEGORIAS');
  const insRows = loadCsv('INSTRUCOES');
  const prdRows = loadCsv('PRODUTOS');
  const atrRows = loadCsv('ATRIBUTOS_TECNICOS');
  const fntRows = loadCsv('FONTES_DOCUMENTACAO');
  const eqvRows = loadCsv('EQUIVALENCIAS');
  const revRows = loadCsv('REVISOES_QUALIDADE');

  const today = new Date().toISOString().slice(0, 10);

  const fabricantes = fabRows.map((r) => ({
    id_fabricante: normNull(r.ID_Fabricante),
    nome_fabricante: normNull(r.Nome_Fabricante),
    pais_origem: normNull(r.Pais_Origem) || 'Não informado',
    site_oficial: normNull(r.Site_Oficial) || 'https://nao-informado.local',
    categoria_de_atuacao: normNull(r.Categoria_de_Atuacao) || 'Automação Industrial',
    observacoes: normNull(r.Observacoes),
  }));

  const categorias = catRows.map((r) => ({
    id_categoria: normNull(r.ID_Categoria),
    categoria_principal: normNull(r.Categoria_Principal),
    subcategoria: normNull(r.Subcategoria),
    descricao: normNull(r.Descricao) || '-',
    tipo_de_equipamento: normNull(r.Tipo_de_Equipamento) || '-',
    atributos_tecnicos_obrigatorios: normNull(r.Atributos_Tecnicos_Obrigatorios) || '-',
  }));

  const instrucoes = insRows.map((r) => ({
    id_diretriz: normNull(r.ID_Diretriz),
    modulo: normNull(r.Modulo),
    topico: normNull(r.Topico),
    regra_ou_diretriz: normNull(r.Regra_ou_Diretriz),
    detalhamento_tecnico: normNull(r.Detalhamento_Tecnico) || '-',
    exemplo_ou_padrao: normNull(r.Exemplo_ou_Padrao),
  }));

  const produtosMap = new Map();
  const produtos = prdRows.map((r) => {
    const p = {
      id_produto: normNull(r.ID_Produto),
      fabricante: normNull(r.Fabricante),
      codigo_comercial: normNull(r.Codigo_Comercial),
      codigo_alternativo: normNull(r.Codigo_Alternativo),
      nome_produto: normNull(r.Nome_Produto),
      categoria: normNull(r.Categoria),
      subcategoria: normNull(r.Subcategoria),
      familia: normNull(r.Familia),
      serie: normNull(r.Serie),
      descricao_comercial: normNull(r.Descricao_Comercial),
      descricao_tecnica: normNull(r.Descricao_Tecnica),
      status_do_produto: normNull(r.Status_do_Produto) || 'Ativo',
      pais_regiao: normNull(r.Pais_Regiao),
      url_oficial: normNull(r.URL_Oficial),
      data_da_coleta: parseDate(r.Data_da_Coleta, today, `PRODUTOS:${r.ID_Produto}`),
      status_da_coleta: normNull(r.Status_da_Coleta) || 'Coletado',
    };
    produtosMap.set(p.id_produto, p);
    return p;
  });

  const atributos = atrRows.map((r) => {
    const valor = sanitizeAttrValue(r.Valor, `ATRIBUTOS:${r.ID_Atributo}`) || '-';
    const valorOriginal = sanitizeAttrValue(r.Valor_Original, `ATRIBUTOS_ORIG:${r.ID_Atributo}`);
    const obrig = normNull(r.Obrigatorio_para_Comparacao);
    if (!obrig) {
      warn(`[ATRIBUTOS] ${r.ID_Atributo}: Obrigatorio_para_Comparacao vazio -> 'Não'`);
    }
    return {
      id_atributo: normNull(r.ID_Atributo),
      id_produto: normNull(r.ID_Produto),
      fabricante: normNull(r.Fabricante),
      categoria: normNull(r.Categoria),
      nome_do_atributo: normNull(r.Nome_do_Atributo),
      valor,
      valor_numerico: extractNumeric(valor),
      unidade: normNull(r.Unidade) || '-',
      valor_original: valorOriginal,
      unidade_original: normNull(r.Unidade_Original),
      descricao_do_atributo: normNull(r.Descricao_do_Atributo),
      obrigatorio_para_comparacao: obrig === 'Sim' ? 'Sim' : 'Não',
      fonte_da_informacao: normNull(r.Fonte_da_Informacao),
    };
  });

  const fontes = fntRows.map((r) => {
    const prod = produtosMap.get(normNull(r.ID_Produto));
    const fallbackDate = prod ? prod.data_da_coleta : today;
    const metodo = normNull(r.Metodo_de_Extracao);
    if (!metodo) {
      warn(`[FONTES] ${r.ID_Fonte}: Metodo_de_Extracao vazio -> 'Não informado'`);
    }
    return {
      id_fonte: normNull(r.ID_Fonte),
      id_produto: normNull(r.ID_Produto),
      fabricante: normNull(r.Fabricante),
      codigo_produto: normNull(r.Codigo_Produto),
      tipo_de_fonte: normNull(r.Tipo_de_Fonte) || 'Não informado',
      nome_do_documento: normNull(r.Nome_do_Documento) || 'Documento sem título',
      url_da_fonte: normNull(r.URL_da_Fonte) || 'https://nao-informado.local',
      pagina_do_documento: normNull(r.Pagina_do_Documento),
      data_de_publicacao: parseDate(r.Data_de_Publicacao, null, `FONTES_PUB:${r.ID_Fonte}`),
      revisao_do_documento: normNull(r.Revisao_do_Documento),
      data_da_coleta: parseDate(r.Data_da_Coleta, fallbackDate, `FONTES_COLETA:${r.ID_Fonte}`),
      metodo_de_extracao: metodo || 'Não informado',
      observacoes: normNull(r.Observacoes),
    };
  });

  // Resolve -REF or missing candidate products in EQUIVALENCIAS without violating chk_prd_id_format or FKs
  let refCounter = 900001;
  const refMap = new Map();
  const defaultSubcatByCat = new Map();
  for (const c of categorias) {
    if (!defaultSubcatByCat.has(c.categoria_principal)) {
      defaultSubcatByCat.set(c.categoria_principal, c.subcategoria);
    }
  }

  const equivalencias = eqvRows.map((r) => {
    let candId = normNull(r.ID_Produto_Candidato);
    const concId = normNull(r.ID_Produto_Concorrente);
    let obs = normNull(r.Observacoes);

    if (candId && !produtosMap.has(candId)) {
      let syntheticId = refMap.get(candId);
      if (!syntheticId) {
        syntheticId = `PRD-${refCounter++}`;
        refMap.set(candId, syntheticId);

        const concProd = produtosMap.get(concId);
        const cat = normNull(r.Categoria) || (concProd && concProd.categoria) || 'Controle e Automacao';
        const subcat = (concProd && concProd.subcategoria) || defaultSubcatByCat.get(cat) || categorias[0].subcategoria;
        const fabCand = normNull(r.Fabricante_Candidato);
        const codCand = normNull(r.Codigo_Candidato);

        const refProd = {
          id_produto: syntheticId,
          fabricante: fabCand,
          codigo_comercial: codCand,
          codigo_alternativo: null,
          nome_produto: `[REFERÊNCIA PENDENTE] ${fabCand} ${codCand}`,
          categoria: cat,
          subcategoria: subcat,
          familia: null,
          serie: null,
          descricao_comercial: `Registro de referência criado automaticamente a partir de ${candId} (${r.ID_Equivalencia}).`,
          descricao_tecnica: null,
          status_do_produto: 'Não informado',
          pais_regiao: null,
          url_oficial: null,
          data_da_coleta: parseDate(r.Data_da_Validacao, today, `EQV_REF:${r.ID_Equivalencia}`),
          status_da_coleta: 'Revisão necessária',
        };
        produtos.push(refProd);
        produtosMap.set(syntheticId, refProd);
        warn(`[EQUIVALENCIAS] ${r.ID_Equivalencia}: "${candId}" (${fabCand} ${codCand}) ausente em PRODUTOS -> criado registro de referência "${syntheticId}" (status_da_coleta='Revisão necessária')`);
      }
      obs = obs ? `${obs} [ID candidato original: ${candId}]` : `[ID candidato original: ${candId}]`;
      candId = syntheticId;
    }

    return {
      id_equivalencia: normNull(r.ID_Equivalencia),
      id_produto_concorrente: concId,
      fabricante_concorrente: normNull(r.Fabricante_Concorrente),
      codigo_concorrente: normNull(r.Codigo_Concorrente),
      id_produto_candidato: candId,
      fabricante_candidato: normNull(r.Fabricante_Candidato),
      codigo_candidato: normNull(r.Codigo_Candidato),
      categoria: normNull(r.Categoria),
      compatibilidade_tecnica: normNull(r.Compatibilidade_Tecnica) || 'Não avaliado',
      compatibilidade_eletrica: normNull(r.Compatibilidade_Eletrica) || 'Não avaliado',
      compatibilidade_funcional: normNull(r.Compatibilidade_Funcional) || 'Não avaliado',
      compatibilidade_de_comunicacao: normNull(r.Compatibilidade_de_Comunicacao) || 'Não avaliado',
      diferencas_identificadas: normNull(r.Diferencas_Identificadas),
      restricoes_de_aplicacao: normNull(r.Restricoes_de_Aplicacao),
      status_da_equivalencia: normNull(r.Status_da_Equivalencia) || 'Não analisado',
      responsavel_tecnico: normNull(r.Responsavel_Tecnico),
      data_da_validacao: parseDate(r.Data_da_Validacao, null, `EQV_VAL:${r.ID_Equivalencia}`),
      observacoes: obs,
    };
  });

  const revisoes = revRows.map((r) => ({
    id_revisao: normNull(r.ID_Revisao),
    id_produto: normNull(r.ID_Produto),
    id_atributo: normNull(r.ID_Atributo),
    informacao_analisada: normNull(r.Informacao_Analisada),
    valor_extraido: normNull(r.Valor_Extraido),
    valor_validado: normNull(r.Valor_Validado),
    status_da_revisao: normNull(r.Status_da_Revisao) || 'Pendente de revisão',
    nivel_de_confianca: normNull(r.Nivel_de_Confianca) || 'Não aplicável',
    responsavel: normNull(r.Responsavel) || 'Não informado',
    data_da_revisao: parseDate(r.Data_da_Revisao, today, `REVISOES:${r.ID_Revisao}`),
    justificativa: normNull(r.Justificativa),
    observacoes: normNull(r.Observacoes),
  }));

  return { fabricantes, categorias, instrucoes, produtos, atributos, fontes, equivalencias, revisoes };
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildUpsertSql(table, cols, conflictCol, rows, updateExclude = []) {
  if (rows.length === 0) return '';
  const values = rows
    .map((r) => `(${cols.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const updates = cols
    .filter((c) => c !== conflictCol && !updateExclude.includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ');
  return `INSERT INTO ${PGSCHEMA}.${table} (${cols.join(', ')}) VALUES\n${values}\nON CONFLICT (${conflictCol}) DO UPDATE SET ${updates};\n`;
}

function emitSqlChunks(data, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const specs = [
    ['fabricantes', ['id_fabricante', 'nome_fabricante', 'pais_origem', 'site_oficial', 'categoria_de_atuacao', 'observacoes'], 'id_fabricante', data.fabricantes, 100],
    ['categorias', ['id_categoria', 'categoria_principal', 'subcategoria', 'descricao', 'tipo_de_equipamento', 'atributos_tecnicos_obrigatorios'], 'id_categoria', data.categorias, 100],
    ['instrucoes', ['id_diretriz', 'modulo', 'topico', 'regra_ou_diretriz', 'detalhamento_tecnico', 'exemplo_ou_padrao'], 'id_diretriz', data.instrucoes, 100],
    ['produtos', ['id_produto', 'fabricante', 'codigo_comercial', 'codigo_alternativo', 'nome_produto', 'categoria', 'subcategoria', 'familia', 'serie', 'descricao_comercial', 'descricao_tecnica', 'status_do_produto', 'pais_regiao', 'url_oficial', 'data_da_coleta', 'status_da_coleta'], 'id_produto', data.produtos, 100],
    ['atributos_tecnicos', ['id_atributo', 'id_produto', 'fabricante', 'categoria', 'nome_do_atributo', 'valor', 'valor_numerico', 'unidade', 'valor_original', 'unidade_original', 'descricao_do_atributo', 'obrigatorio_para_comparacao', 'fonte_da_informacao'], 'id_atributo', data.atributos, 400],
    ['fontes_documentacao', ['id_fonte', 'id_produto', 'fabricante', 'codigo_produto', 'tipo_de_fonte', 'nome_do_documento', 'url_da_fonte', 'pagina_do_documento', 'data_de_publicacao', 'revisao_do_documento', 'data_da_coleta', 'metodo_de_extracao', 'observacoes'], 'id_fonte', data.fontes, 150],
    ['equivalencias', ['id_equivalencia', 'id_produto_concorrente', 'fabricante_concorrente', 'codigo_concorrente', 'id_produto_candidato', 'fabricante_candidato', 'codigo_candidato', 'categoria', 'compatibilidade_tecnica', 'compatibilidade_eletrica', 'compatibilidade_funcional', 'compatibilidade_de_comunicacao', 'diferencas_identificadas', 'restricoes_de_aplicacao', 'status_da_equivalencia', 'responsavel_tecnico', 'data_da_validacao', 'observacoes'], 'id_equivalencia', data.equivalencias, 50],
    ['revisoes_qualidade', ['id_revisao', 'id_produto', 'id_atributo', 'informacao_analisada', 'valor_extraido', 'valor_validado', 'status_da_revisao', 'nivel_de_confianca', 'responsavel', 'data_da_revisao', 'justificativa', 'observacoes'], 'id_revisao', data.revisoes, 100],
  ];

  const files = [];
  let idx = 1;
  for (const [table, cols, pk, rows, batchSize] of specs) {
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const sql = `BEGIN;\n${buildUpsertSql(table, cols, pk, chunk)}COMMIT;\n`;
      const fname = `${String(idx++).padStart(2, '0')}_${table}.sql`;
      fs.writeFileSync(path.join(outDir, fname), sql, 'utf8');
      files.push(fname);
    }
  }
  return files;
}

async function upsertBatchPg(client, table, cols, conflictCol, rows, batchSize = 200) {
  if (rows.length === 0) return;
  const updates = cols
    .filter((c) => c !== conflictCol)
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ');

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const params = [];
    const placeholders = chunk.map((row) => {
      const ph = cols.map((c) => {
        params.push(row[c]);
        return `$${params.length}`;
      });
      return `(${ph.join(', ')})`;
    });
    const sql = `INSERT INTO ${PGSCHEMA}.${table} (${cols.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT (${conflictCol}) DO UPDATE SET ${updates}`;
    await client.query(sql, params);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const emitIdx = args.indexOf('--emit-sql');
  const emitDir = emitIdx !== -1 ? args[emitIdx + 1] : null;

  const data = prepareDataset();

  console.log('=== RESUMO DE SANEAMENTO ===');
  for (const [k, v] of Object.entries(data)) {
    console.log(`  ${k}: ${v.length} registros`);
  }
  console.log(`=== AVISOS (${warnings.length}) ===`);
  warnings.forEach((w) => console.log('  -', w));

  if (emitDir) {
    const files = emitSqlChunks(data, emitDir);
    console.log(`\nSQL chunks gerados em ${emitDir}:`, files);
  }
  if (dryRun || emitDir) return;

  if (!process.env.PGHOST || !process.env.PGDATABASE || !process.env.PGUSER || !process.env.PGPASSWORD) {
    console.error('\nErro: defina PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD no .env ou ambiente.');
    process.exit(1);
  }

  const useSsl = process.env.PGSSL === 'true' || /supabase\.co/i.test(process.env.PGHOST);
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${PGSCHEMA}, public`);

    await upsertBatchPg(client, 'fabricantes', ['id_fabricante', 'nome_fabricante', 'pais_origem', 'site_oficial', 'categoria_de_atuacao', 'observacoes'], 'id_fabricante', data.fabricantes);
    await upsertBatchPg(client, 'categorias', ['id_categoria', 'categoria_principal', 'subcategoria', 'descricao', 'tipo_de_equipamento', 'atributos_tecnicos_obrigatorios'], 'id_categoria', data.categorias);
    await upsertBatchPg(client, 'instrucoes', ['id_diretriz', 'modulo', 'topico', 'regra_ou_diretriz', 'detalhamento_tecnico', 'exemplo_ou_padrao'], 'id_diretriz', data.instrucoes);
    await upsertBatchPg(client, 'produtos', ['id_produto', 'fabricante', 'codigo_comercial', 'codigo_alternativo', 'nome_produto', 'categoria', 'subcategoria', 'familia', 'serie', 'descricao_comercial', 'descricao_tecnica', 'status_do_produto', 'pais_regiao', 'url_oficial', 'data_da_coleta', 'status_da_coleta'], 'id_produto', data.produtos);
    await upsertBatchPg(client, 'atributos_tecnicos', ['id_atributo', 'id_produto', 'fabricante', 'categoria', 'nome_do_atributo', 'valor', 'valor_numerico', 'unidade', 'valor_original', 'unidade_original', 'descricao_do_atributo', 'obrigatorio_para_comparacao', 'fonte_da_informacao'], 'id_atributo', data.atributos);
    await upsertBatchPg(client, 'fontes_documentacao', ['id_fonte', 'id_produto', 'fabricante', 'codigo_produto', 'tipo_de_fonte', 'nome_do_documento', 'url_da_fonte', 'pagina_do_documento', 'data_de_publicacao', 'revisao_do_documento', 'data_da_coleta', 'metodo_de_extracao', 'observacoes'], 'id_fonte', data.fontes);
    await upsertBatchPg(client, 'equivalencias', ['id_equivalencia', 'id_produto_concorrente', 'fabricante_concorrente', 'codigo_concorrente', 'id_produto_candidato', 'fabricante_candidato', 'codigo_candidato', 'categoria', 'compatibilidade_tecnica', 'compatibilidade_eletrica', 'compatibilidade_funcional', 'compatibilidade_de_comunicacao', 'diferencas_identificadas', 'restricoes_de_aplicacao', 'status_da_equivalencia', 'responsavel_tecnico', 'data_da_validacao', 'observacoes'], 'id_equivalencia', data.equivalencias);
    await upsertBatchPg(client, 'revisoes_qualidade', ['id_revisao', 'id_produto', 'id_atributo', 'informacao_analisada', 'valor_extraido', 'valor_validado', 'status_da_revisao', 'nivel_de_confianca', 'responsavel', 'data_da_revisao', 'justificativa', 'observacoes'], 'id_revisao', data.revisoes);

    await client.query('COMMIT');
    console.log('\nMigração concluída com sucesso (COMMIT)!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nErro na migração (ROLLBACK executado):', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
