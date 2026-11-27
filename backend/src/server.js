'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const { DataService } = require('./dataService');

const PORT = Number(process.env.PORT || 3001);
const app = express();
const db = new DataService();

app.use(cors());
app.use(express.json());

function normalizeText(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const k = keyFn(item) || 'Não informado';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

app.get('/api/health', async (_req, res) => {
  try {
    const [produtos, fabricantes, categorias, equivalencias, atributos, fontes] = await Promise.all([
      db.getAll('produtos'),
      db.getAll('fabricantes'),
      db.getAll('categorias'),
      db.getAll('equivalencias'),
      db.getAll('atributos_tecnicos'),
      db.getAll('fontes_documentacao'),
    ]);
    res.json({
      ok: true,
      source: db.mode,
      counts: {
        produtos: produtos.length,
        fabricantes: fabricantes.length,
        categorias: categorias.length,
        equivalencias: equivalencias.length,
        atributos: atributos.length,
        fontes: fontes.length,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const [produtos, fabricantes, categorias, equivalencias, atributos, fontes] = await Promise.all([
      db.getAll('produtos'),
      db.getAll('fabricantes'),
      db.getAll('categorias'),
      db.getAll('equivalencias'),
      db.getAll('atributos_tecnicos'),
      db.getAll('fontes_documentacao'),
    ]);

    const aprovadas = equivalencias.filter((e) =>
      ['Aprovado', 'Aprovado com ressalvas'].includes(e.status_da_equivalencia)
    ).length;

    res.json({
      source: db.mode,
      kpis: {
        totalProdutos: produtos.length,
        totalFabricantes: fabricantes.length,
        totalCategorias: categorias.length,
        totalEquivalencias: equivalencias.length,
        equivalenciasAprovadas: aprovadas,
        totalAtributos: atributos.length,
        totalFontes: fontes.length,
      },
      produtosPorFabricante: countBy(produtos, (p) => p.fabricante).slice(0, 10),
      produtosPorCategoria: countBy(produtos, (p) => p.categoria),
      produtosPorStatusColeta: countBy(produtos, (p) => p.status_da_coleta),
      equivalenciasPorStatus: countBy(equivalencias, (e) => e.status_da_equivalencia),
      recentEquivalencias: equivalencias.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fabricantes', async (_req, res) => {
  try {
    const [fabricantes, produtos] = await Promise.all([
      db.getAll('fabricantes'),
      db.getAll('produtos'),
    ]);
    const counts = new Map();
    for (const p of produtos) {
      counts.set(p.fabricante, (counts.get(p.fabricante) || 0) + 1);
    }
    res.json(
      fabricantes.map((f) => ({
        ...f,
        total_produtos: counts.get(f.nome_fabricante) || 0,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/categorias', async (_req, res) => {
  try {
    const [categorias, produtos] = await Promise.all([
      db.getAll('categorias'),
      db.getAll('produtos'),
    ]);
    const counts = new Map();
    for (const p of produtos) {
      const key = `${p.categoria}::${p.subcategoria}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    res.json(
      categorias.map((c) => ({
        ...c,
        total_produtos: counts.get(`${c.categoria_principal}::${c.subcategoria}`) || 0,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/produtos', async (req, res) => {
  try {
    const {
      search = '',
      fabricante = '',
      categoria = '',
      subcategoria = '',
      status_do_produto = '',
      status_da_coleta = '',
      page = '1',
      limit = '25',
    } = req.query;

    let items = await db.getAll('produtos');
    const q = normalizeText(search);

    if (q) {
      items = items.filter((p) =>
        [
          p.id_produto,
          p.codigo_comercial,
          p.codigo_alternativo,
          p.nome_produto,
          p.fabricante,
          p.familia,
          p.serie,
        ].some((field) => normalizeText(field).includes(q))
      );
    }
    if (fabricante) items = items.filter((p) => p.fabricante === fabricante);
    if (categoria) items = items.filter((p) => p.categoria === categoria);
    if (subcategoria) items = items.filter((p) => p.subcategoria === subcategoria);
    if (status_do_produto) items = items.filter((p) => p.status_do_produto === status_do_produto);
    if (status_da_coleta) items = items.filter((p) => p.status_da_coleta === status_da_coleta);

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(500, Math.max(1, Number(limit) || 25));
    const total = items.length;
    const start = (pageNum - 1) * limitNum;

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      items: items.slice(start, start + limitNum),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [produtos, atributos, fontes, equivalencias] = await Promise.all([
      db.getAll('produtos'),
      db.getAll('atributos_tecnicos'),
      db.getAll('fontes_documentacao'),
      db.getAll('equivalencias'),
    ]);

    const produto = produtos.find((p) => p.id_produto === id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    res.json({
      produto,
      atributos: atributos.filter((a) => a.id_produto === id),
      fontes: fontes.filter((f) => f.id_produto === id),
      equivalencias: equivalencias.filter(
        (e) => e.id_produto_concorrente === id || e.id_produto_candidato === id
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/equivalencias', async (req, res) => {
  try {
    const { search = '', status = '', categoria = '' } = req.query;
    let items = await db.getAll('equivalencias');
    const q = normalizeText(search);

    if (q) {
      items = items.filter((e) =>
        [
          e.id_equivalencia,
          e.fabricante_concorrente,
          e.codigo_concorrente,
          e.fabricante_candidato,
          e.codigo_candidato,
          e.responsavel_tecnico,
          e.diferencas_identificadas,
        ].some((field) => normalizeText(field).includes(q))
      );
    }
    if (status) items = items.filter((e) => e.status_da_equivalencia === status);
    if (categoria) items = items.filter((e) => e.categoria === categoria);

    res.json({ total: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/equivalencias', async (req, res) => {
  try {
    const created = await db.createEquivalencia(req.body || {});
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/equivalencias/:id', async (req, res) => {
  try {
    const updated = await db.updateEquivalencia(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Equivalência não encontrada' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comparar', async (req, res) => {
  try {
    const { concorrente, candidato } = req.query;
    if (!concorrente || !candidato) {
      return res.status(400).json({ error: 'Informe os parâmetros concorrente e candidato.' });
    }

    const [produtos, atributos, equivalencias] = await Promise.all([
      db.getAll('produtos'),
      db.getAll('atributos_tecnicos'),
      db.getAll('equivalencias'),
    ]);

    const prodConcorrente = produtos.find((p) => p.id_produto === concorrente);
    const prodCandidato = produtos.find((p) => p.id_produto === candidato);
    if (!prodConcorrente || !prodCandidato) {
      return res.status(404).json({ error: 'Produto concorrente ou candidato não encontrado.' });
    }

    const atrConc = atributos.filter((a) => a.id_produto === concorrente);
    const atrCand = atributos.filter((a) => a.id_produto === candidato);

    const mapConc = new Map(atrConc.map((a) => [a.nome_do_atributo, a]));
    const mapCand = new Map(atrCand.map((a) => [a.nome_do_atributo, a]));
    const allNames = Array.from(new Set([...mapConc.keys(), ...mapCand.keys()]));

    const matrix = allNames.map((nome) => {
      const a = mapConc.get(nome);
      const b = mapCand.get(nome);
      const valA = a ? `${a.valor}${a.unidade && a.unidade !== '-' ? ' ' + a.unidade : ''}` : null;
      const valB = b ? `${b.valor}${b.unidade && b.unidade !== '-' ? ' ' + b.unidade : ''}` : null;
      const obrigatorio = (a && a.obrigatorio_para_comparacao === 'Sim') || (b && b.obrigatorio_para_comparacao === 'Sim');
      const igual = Boolean(valA && valB && normalizeText(valA) === normalizeText(valB));

      return {
        nome_do_atributo: nome,
        obrigatorio,
        descricao: (a && a.descricao_do_atributo) || (b && b.descricao_do_atributo) || null,
        concorrente: a || null,
        candidato: b || null,
        igual,
      };
    });

    matrix.sort((x, y) => Number(y.obrigatorio) - Number(x.obrigatorio));

    const equivalenciaExistente = equivalencias.find(
      (e) =>
        (e.id_produto_concorrente === concorrente && e.id_produto_candidato === candidato) ||
        (e.id_produto_concorrente === candidato && e.id_produto_candidato === concorrente)
    ) || null;

    res.json({
      concorrente: prodConcorrente,
      candidato: prodCandidato,
      equivalencia: equivalenciaExistente,
      resumo: {
        totalAtributos: matrix.length,
        obrigatorios: matrix.filter((m) => m.obrigatorio).length,
        iguais: matrix.filter((m) => m.igual).length,
      },
      matrix,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend SistemaConversao rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erro ao inicializar servidor:', err);
    process.exit(1);
  });
