'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

const CSV_DIR = process.env.CSV_DIR || path.resolve(__dirname, '..', '..');
const PGSCHEMA = process.env.PGSCHEMA || 'catalogo_automacao';

function normNull(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (/^(nan|null|n\/a|none|undefined)$/i.test(s)) return null;
  return s;
}

function parseDate(val, fallback = null) {
  const s = normNull(val);
  if (!s) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial >= 20000 && serial <= 70000) {
      const utcMs = Date.UTC(1899, 11, 30) + serial * 86400000;
      return new Date(utcMs).toISOString().slice(0, 10);
    }
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return fallback;
}

function sanitizeAttrValue(val) {
  const s = normNull(val);
  if (!s) return null;
  const isoMatch = s.match(/^20\d{2}-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${Number(isoMatch[2])}.${Number(isoMatch[1])}`;
  return s;
}

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
  if (!fs.existsSync(CSV_DIR)) return [];
  const files = fs.readdirSync(CSV_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  const pattern = tabName.toUpperCase();
  const matches = files.filter((f) => {
    const upper = f.toUpperCase();
    return (upper.includes(`- ${pattern}.CSV`) || upper === `${pattern}.CSV` || upper.includes(pattern))
      && !/\(\d+\)\.csv$/i.test(f);
  });
  const file = matches[0] || files.find((f) => f.toUpperCase().includes(pattern));
  if (!file) return [];
  const raw = fs.readFileSync(path.join(CSV_DIR, file), 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true, trim: true });
}

function loadDatasetFromCsv() {
  const fabRows = loadCsv('FABRICANTES');
  const catRows = loadCsv('CATEGORIAS');
  const prdRows = loadCsv('PRODUTOS');
  const atrRows = loadCsv('ATRIBUTOS_TECNICOS');
  const fntRows = loadCsv('FONTES_DOCUMENTACAO');
  const eqvRows = loadCsv('EQUIVALENCIAS');
  const today = new Date().toISOString().slice(0, 10);

  const fabricantes = fabRows.map((r) => ({
    id_fabricante: normNull(r.ID_Fabricante),
    nome_fabricante: normNull(r.Nome_Fabricante),
    pais_origem: normNull(r.Pais_Origem) || 'Não informado',
    site_oficial: normNull(r.Site_Oficial) || '',
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
      data_da_coleta: parseDate(r.Data_da_Coleta, today),
      status_da_coleta: normNull(r.Status_da_Coleta) || 'Coletado',
    };
    produtosMap.set(p.id_produto, p);
    return p;
  });

  const atributos = atrRows.map((r) => {
    const valor = sanitizeAttrValue(r.Valor) || '-';
    const valorOriginal = sanitizeAttrValue(r.Valor_Original);
    const obrig = normNull(r.Obrigatorio_para_Comparacao);
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
    return {
      id_fonte: normNull(r.ID_Fonte),
      id_produto: normNull(r.ID_Produto),
      fabricante: normNull(r.Fabricante),
      codigo_produto: normNull(r.Codigo_Produto),
      tipo_de_fonte: normNull(r.Tipo_de_Fonte) || 'Não informado',
      nome_do_documento: normNull(r.Nome_do_Documento) || 'Documento sem título',
      url_da_fonte: normNull(r.URL_da_Fonte) || '',
      pagina_do_documento: normNull(r.Pagina_do_Documento),
      data_de_publicacao: parseDate(r.Data_de_Publicacao, null),
      revisao_do_documento: normNull(r.Revisao_do_Documento),
      data_da_coleta: parseDate(r.Data_da_Coleta, fallbackDate),
      metodo_de_extracao: normNull(r.Metodo_de_Extracao) || 'Não informado',
      observacoes: normNull(r.Observacoes),
    };
  });

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
        const subcat = (concProd && concProd.subcategoria) || defaultSubcatByCat.get(cat) || (categorias[0] && categorias[0].subcategoria) || '-';
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
          data_da_coleta: parseDate(r.Data_da_Validacao, today),
          status_da_coleta: 'Revisão necessária',
        };
        produtos.push(refProd);
        produtosMap.set(syntheticId, refProd);
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
      data_da_validacao: parseDate(r.Data_da_Validacao, null),
      observacoes: obs,
    };
  });

  return { fabricantes, categorias, produtos, atributos, fontes, equivalencias };
}

class DataService {
  constructor() {
    this.mode = 'csv';
    this.pool = null;
    this.data = null;
  }

  async init() {
    const hasPg = Boolean(
      process.env.PGHOST &&
      process.env.PGDATABASE &&
      process.env.PGUSER &&
      process.env.PGPASSWORD &&
      process.env.PGPASSWORD !== 'YOUR_DATABASE_PASSWORD'
    );

    if (hasPg) {
      try {
        const useSsl = process.env.PGSSL === 'true' || /supabase\.co/i.test(process.env.PGHOST);
        this.pool = new Pool({
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT || 5432),
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
        });
        await this.pool.query(`SELECT 1 FROM ${PGSCHEMA}.produtos LIMIT 1`);
        this.mode = 'postgres';
        console.log(`[DataService] Conectado ao PostgreSQL (schema: ${PGSCHEMA})`);
        return;
      } catch (err) {
        console.warn(`[DataService] Falha ao conectar ao PostgreSQL (${err.message}). Usando CSV em memória.`);
        if (this.pool) {
          await this.pool.end().catch(() => {});
          this.pool = null;
        }
      }
    }

    this.data = loadDatasetFromCsv();
    this.mode = 'csv';
    console.log(
      `[DataService] Carregado via CSV (${this.data.produtos.length} produtos, ${this.data.atributos.length} atributos, ${this.data.equivalencias.length} equivalências)`
    );
  }

  async getAll(table) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query(`SELECT * FROM ${PGSCHEMA}.${table}`);
      return res.rows;
    }
    const map = {
      fabricantes: this.data.fabricantes,
      categorias: this.data.categorias,
      produtos: this.data.produtos,
      atributos_tecnicos: this.data.atributos,
      fontes_documentacao: this.data.fontes,
      equivalencias: this.data.equivalencias,
    };
    return map[table] || [];
  }

  async createEquivalencia(payload) {
    const existing = await this.getAll('equivalencias');
    const maxNum = existing.reduce((max, item) => {
      const m = String(item.id_equivalencia || '').match(/EQV-(\d+)/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    const id_equivalencia = `EQV-${String(maxNum + 1).padStart(6, '0')}`;
    const record = {
      id_equivalencia,
      id_produto_concorrente: payload.id_produto_concorrente,
      fabricante_concorrente: payload.fabricante_concorrente,
      codigo_concorrente: payload.codigo_concorrente,
      id_produto_candidato: payload.id_produto_candidato,
      fabricante_candidato: payload.fabricante_candidato,
      codigo_candidato: payload.codigo_candidato,
      categoria: payload.categoria,
      compatibilidade_tecnica: payload.compatibilidade_tecnica || 'Não avaliado',
      compatibilidade_eletrica: payload.compatibilidade_eletrica || 'Não avaliado',
      compatibilidade_funcional: payload.compatibilidade_funcional || 'Não avaliado',
      compatibilidade_de_comunicacao: payload.compatibilidade_de_comunicacao || 'Não avaliado',
      diferencas_identificadas: payload.diferencas_identificadas || null,
      restricoes_de_aplicacao: payload.restricoes_de_aplicacao || null,
      status_da_equivalencia: payload.status_da_equivalencia || 'Candidato identificado',
      responsavel_tecnico: payload.responsavel_tecnico || 'Engenharia de Aplicação',
      data_da_validacao: payload.data_da_validacao || new Date().toISOString().slice(0, 10),
      observacoes: payload.observacoes || null,
    };

    if (this.mode === 'postgres') {
      const cols = Object.keys(record);
      const vals = Object.values(record);
      const placeholders = vals.map((_, idx) => `$${idx + 1}`).join(', ');
      await this.pool.query(
        `INSERT INTO ${PGSCHEMA}.equivalencias (${cols.join(', ')}) VALUES (${placeholders})`,
        vals
      );
    } else {
      this.data.equivalencias.unshift(record);
    }
    return record;
  }

  async updateEquivalencia(id, updates) {
    const allowed = [
      'compatibilidade_tecnica',
      'compatibilidade_eletrica',
      'compatibilidade_funcional',
      'compatibilidade_de_comunicacao',
      'diferencas_identificadas',
      'restricoes_de_aplicacao',
      'status_da_equivalencia',
      'responsavel_tecnico',
      'data_da_validacao',
      'observacoes',
    ];
    const clean = {};
    for (const k of allowed) {
      if (updates[k] !== undefined) clean[k] = updates[k];
    }

    if (this.mode === 'postgres') {
      const keys = Object.keys(clean);
      if (keys.length === 0) return null;
      const sets = keys.map((k, idx) => `${k} = $${idx + 1}`).join(', ');
      const vals = [...keys.map((k) => clean[k]), id];
      const res = await this.pool.query(
        `UPDATE ${PGSCHEMA}.equivalencias SET ${sets} WHERE id_equivalencia = $${vals.length} RETURNING *`,
        vals
      );
      return res.rows[0] || null;
    }

    const idx = this.data.equivalencias.findIndex((e) => e.id_equivalencia === id);
    if (idx === -1) return null;
    this.data.equivalencias[idx] = { ...this.data.equivalencias[idx], ...clean };
    return this.data.equivalencias[idx];
  }
}

module.exports = { DataService };
