export interface Fabricante {
  id_fabricante: string;
  nome_fabricante: string;
  pais_origem: string;
  site_oficial: string;
  categoria_de_atuacao: string;
  observacoes: string | null;
  total_produtos?: number;
}

export interface Categoria {
  id_categoria: string;
  categoria_principal: string;
  subcategoria: string;
  descricao: string;
  tipo_de_equipamento: string;
  atributos_tecnicos_obrigatorios: string;
  total_produtos?: number;
}

export interface Produto {
  id_produto: string;
  fabricante: string;
  codigo_comercial: string;
  codigo_alternativo: string | null;
  nome_produto: string;
  categoria: string;
  subcategoria: string;
  familia: string | null;
  serie: string | null;
  descricao_comercial: string | null;
  descricao_tecnica: string | null;
  status_do_produto: string;
  pais_regiao: string | null;
  url_oficial: string | null;
  data_da_coleta: string | null;
  status_da_coleta: string;
}

export interface AtributoTecnico {
  id_atributo: string;
  id_produto: string;
  fabricante: string;
  categoria: string;
  nome_do_atributo: string;
  valor: string;
  valor_numerico: number | null;
  unidade: string;
  valor_original: string | null;
  unidade_original: string | null;
  descricao_do_atributo: string | null;
  obrigatorio_para_comparacao: string;
  fonte_da_informacao: string | null;
}

export interface FonteDocumentacao {
  id_fonte: string;
  id_produto: string;
  fabricante: string;
  codigo_produto: string;
  tipo_de_fonte: string;
  nome_do_documento: string;
  url_da_fonte: string;
  pagina_do_documento: string | null;
  data_de_publicacao: string | null;
  revisao_do_documento: string | null;
  data_da_coleta: string | null;
  metodo_de_extracao: string;
  observacoes: string | null;
}

export interface Equivalencia {
  id_equivalencia: string;
  id_produto_concorrente: string;
  fabricante_concorrente: string;
  codigo_concorrente: string;
  id_produto_candidato: string;
  fabricante_candidato: string;
  codigo_candidato: string;
  categoria: string;
  compatibilidade_tecnica: string;
  compatibilidade_eletrica: string;
  compatibilidade_funcional: string;
  compatibilidade_de_comunicacao: string;
  diferencas_identificadas: string | null;
  restricoes_de_aplicacao: string | null;
  status_da_equivalencia: string;
  responsavel_tecnico: string | null;
  data_da_validacao: string | null;
  observacoes: string | null;
}

export interface DashboardData {
  source: string;
  kpis: {
    totalProdutos: number;
    totalFabricantes: number;
    totalCategorias: number;
    totalEquivalencias: number;
    equivalenciasAprovadas: number;
    totalAtributos: number;
    totalFontes: number;
  };
  produtosPorFabricante: { name: string; count: number }[];
  produtosPorCategoria: { name: string; count: number }[];
  produtosPorStatusColeta: { name: string; count: number }[];
  equivalenciasPorStatus: { name: string; count: number }[];
  recentEquivalencias: Equivalencia[];
}

export interface ProdutoDetailResponse {
  produto: Produto;
  atributos: AtributoTecnico[];
  fontes: FonteDocumentacao[];
  equivalencias: Equivalencia[];
}

export interface ComparacaoMatrixRow {
  nome_do_atributo: string;
  obrigatorio: boolean;
  descricao: string | null;
  concorrente: AtributoTecnico | null;
  candidato: AtributoTecnico | null;
  igual: boolean;
}

export interface ComparacaoResponse {
  concorrente: Produto;
  candidato: Produto;
  equivalencia: Equivalencia | null;
  resumo: {
    totalAtributos: number;
    obrigatorios: number;
    iguais: number;
  };
  matrix: ComparacaoMatrixRow[];
}
