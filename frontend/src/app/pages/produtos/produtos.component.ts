import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TabsModule } from 'primeng/tabs';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CatalogService } from '../../services/catalog.service';
import { Produto, ProdutoDetailResponse } from '../../models/catalog.models';

@Component({
  selector: 'app-produtos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    InputTextModule,
    SelectModule,
    ButtonModule,
    TagModule,
    DialogModule,
    TabsModule,
    IconFieldModule,
    InputIconModule,
  ],
  template: `
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Catálogo de Produtos</h1>
          <p class="text-sm text-slate-500">
            Consulte equipamentos, especificações técnicas, documentação e equivalências vinculadas.
          </p>
        </div>
        <span class="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-200 text-slate-700">
          {{ total() }} produtos encontrados
        </span>
      </div>

      <!-- Filtros -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        <p-iconfield>
          <p-inputicon styleClass="pi pi-search" />
          <input
            pInputText
            type="text"
            [(ngModel)]="search"
            (ngModelChange)="onFilterChange()"
            placeholder="Buscar código, nome, família..."
            class="w-full"
          />
        </p-iconfield>

        <p-select
          [options]="fabricanteOptions()"
          [(ngModel)]="selectedFabricante"
          (ngModelChange)="onFilterChange()"
          placeholder="Todos os fabricantes"
          [showClear]="true"
          class="w-full"
        />

        <p-select
          [options]="categoriaOptions()"
          [(ngModel)]="selectedCategoria"
          (ngModelChange)="onFilterChange()"
          placeholder="Todas as categorias"
          [showClear]="true"
          class="w-full"
        />

        <p-button
          label="Limpar filtros"
          icon="pi pi-filter-slash"
          severity="secondary"
          [outlined]="true"
          (onClick)="clearFilters()"
          styleClass="w-full"
        />
      </div>

      <!-- Tabela -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <p-table
          [value]="produtos()"
          [loading]="loading()"
          [lazy]="true"
          [paginator]="true"
          [rows]="limit"
          [totalRecords]="total()"
          [rowsPerPageOptions]="[15, 25, 50]"
          (onLazyLoad)="onPage($event)"
          [tableStyle]="{ 'min-width': '60rem' }"
          styleClass="p-datatable-sm"
        >
          <ng-template #header>
            <tr>
              <th>ID</th>
              <th>Fabricante</th>
              <th>Código Comercial</th>
              <th>Nome do Produto</th>
              <th>Categoria / Subcategoria</th>
              <th>Status Coleta</th>
              <th class="text-right">Ações</th>
            </tr>
          </ng-template>
          <ng-template #body let-p>
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="font-mono text-xs text-slate-500">{{ p.id_produto }}</td>
              <td class="font-semibold text-xs text-slate-800">{{ p.fabricante }}</td>
              <td>
                <div class="font-mono text-xs font-semibold text-blue-700">{{ p.codigo_comercial }}</div>
                @if (p.codigo_alternativo) {
                  <div class="font-mono text-[11px] text-slate-400">Alt: {{ p.codigo_alternativo }}</div>
                }
              </td>
              <td>
                <div class="text-xs font-medium text-slate-800">{{ p.nome_produto }}</div>
                @if (p.familia) {
                  <div class="text-[11px] text-slate-400">{{ p.familia }}</div>
                }
              </td>
              <td>
                <div class="text-xs text-slate-700">{{ p.categoria }}</div>
                <div class="text-[11px] text-slate-400">{{ p.subcategoria }}</div>
              </td>
              <td>
                <p-tag
                  [value]="p.status_da_coleta"
                  [severity]="p.status_da_coleta === 'Validado' ? 'success' : p.status_da_coleta === 'Revisão necessária' ? 'warn' : 'info'"
                />
              </td>
              <td class="text-right">
                <p-button
                  label="Detalhes"
                  icon="pi pi-eye"
                  size="small"
                  [outlined]="true"
                  (onClick)="openDetail(p.id_produto)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <!-- Modal de Detalhes do Produto -->
    <p-dialog
      [(visible)]="detailVisible"
      [modal]="true"
      [style]="{ width: 'min(95vw, 68rem)' }"
      [header]="detail()?.produto?.nome_produto || 'Detalhes do Produto'"
    >
      @if (detailLoading()) {
        <div class="py-12 text-center text-slate-500 text-sm">
          <i class="pi pi-spin pi-spinner mr-2"></i> Carregando especificações...
        </div>
      } @else if (detail()) {
        <div class="space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div class="text-[11px] uppercase text-slate-400 font-semibold">Fabricante &amp; Código</div>
              <div class="text-sm font-bold text-slate-900">{{ detail()!.produto.fabricante }}</div>
              <div class="font-mono text-xs text-blue-700">{{ detail()!.produto.codigo_comercial }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase text-slate-400 font-semibold">Categoria</div>
              <div class="text-sm font-medium text-slate-800">{{ detail()!.produto.categoria }}</div>
              <div class="text-xs text-slate-500">{{ detail()!.produto.subcategoria }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase text-slate-400 font-semibold">Status &amp; Coleta</div>
              <div class="flex items-center gap-2 mt-1">
                <p-tag [value]="detail()!.produto.status_do_produto" severity="info" />
                <p-tag [value]="detail()!.produto.status_da_coleta" severity="success" />
              </div>
            </div>
          </div>

          @if (detail()!.produto.descricao_comercial || detail()!.produto.descricao_tecnica) {
            <div class="text-xs text-slate-600 space-y-2 bg-white p-4 rounded-xl border border-slate-200">
              @if (detail()!.produto.descricao_comercial) {
                <p><strong>Descrição Comercial:</strong> {{ detail()!.produto.descricao_comercial }}</p>
              }
              @if (detail()!.produto.descricao_tecnica) {
                <p><strong>Resumo Técnico:</strong> {{ detail()!.produto.descricao_tecnica }}</p>
              }
            </div>
          }

          <p-tabs value="0">
            <p-tablist>
              <p-tab value="0">Atributos Técnicos ({{ detail()!.atributos.length }})</p-tab>
              <p-tab value="1">Fontes Documentais ({{ detail()!.fontes.length }})</p-tab>
              <p-tab value="2">Equivalências ({{ detail()!.equivalencias.length }})</p-tab>
            </p-tablist>
            <p-tabpanels>
              <p-tabpanel value="0">
                <p-table [value]="detail()!.atributos" styleClass="p-datatable-sm">
                  <ng-template #header>
                    <tr>
                      <th>Atributo</th>
                      <th>Valor</th>
                      <th>Unidade</th>
                      <th>Obrigatório</th>
                      <th>Fonte</th>
                    </tr>
                  </ng-template>
                  <ng-template #body let-a>
                    <tr>
                      <td class="text-xs font-semibold text-slate-800">{{ a.nome_do_atributo }}</td>
                      <td class="font-mono text-xs text-blue-700">{{ a.valor }}</td>
                      <td class="text-xs text-slate-500">{{ a.unidade }}</td>
                      <td>
                        <p-tag
                          [value]="a.obrigatorio_para_comparacao"
                          [severity]="a.obrigatorio_para_comparacao === 'Sim' ? 'warn' : 'secondary'"
                        />
                      </td>
                      <td class="text-xs text-slate-500">{{ a.fonte_da_informacao || '-' }}</td>
                    </tr>
                  </ng-template>
                </p-table>
              </p-tabpanel>

              <p-tabpanel value="1">
                <p-table [value]="detail()!.fontes" styleClass="p-datatable-sm">
                  <ng-template #header>
                    <tr>
                      <th>Tipo</th>
                      <th>Documento</th>
                      <th>Revisão / Página</th>
                      <th>Link</th>
                    </tr>
                  </ng-template>
                  <ng-template #body let-f>
                    <tr>
                      <td><p-tag [value]="f.tipo_de_fonte" severity="info" /></td>
                      <td class="text-xs font-medium text-slate-800">{{ f.nome_do_documento }}</td>
                      <td class="text-xs text-slate-500">
                        {{ f.revisao_do_documento || '-' }} {{ f.pagina_do_documento ? '(' + f.pagina_do_documento + ')' : '' }}
                      </td>
                      <td>
                        @if (f.url_da_fonte) {
                          <a
                            [href]="f.url_da_fonte"
                            target="_blank"
                            rel="noopener"
                            class="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            Abrir <i class="pi pi-external-link text-[10px]"></i>
                          </a>
                        }
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              </p-tabpanel>

              <p-tabpanel value="2">
                @if (detail()!.equivalencias.length === 0) {
                  <p class="text-xs text-slate-500 py-4">Nenhuma equivalência registrada para este produto.</p>
                } @else {
                  <p-table [value]="detail()!.equivalencias" styleClass="p-datatable-sm">
                    <ng-template #header>
                      <tr>
                        <th>ID</th>
                        <th>Concorrente</th>
                        <th>Candidato</th>
                        <th>Status</th>
                        <th>Diferenças</th>
                      </tr>
                    </ng-template>
                    <ng-template #body let-eq>
                      <tr>
                        <td class="font-mono text-xs">{{ eq.id_equivalencia }}</td>
                        <td class="text-xs">{{ eq.fabricante_concorrente }} ({{ eq.codigo_concorrente }})</td>
                        <td class="text-xs">{{ eq.fabricante_candidato }} ({{ eq.codigo_candidato }})</td>
                        <td><p-tag [value]="eq.status_da_equivalencia" severity="info" /></td>
                        <td class="text-xs text-slate-600">{{ eq.diferencas_identificadas || '-' }}</td>
                      </tr>
                    </ng-template>
                  </p-table>
                }
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        </div>
      }
    </p-dialog>
  `,
})
export class ProdutosComponent implements OnInit {
  private catalog = inject(CatalogService);

  produtos = signal<Produto[]>([]);
  total = signal(0);
  loading = signal(false);

  fabricanteOptions = signal<string[]>([]);
  categoriaOptions = signal<string[]>([]);

  search = '';
  selectedFabricante = '';
  selectedCategoria = '';
  page = 1;
  limit = 15;

  detailVisible = false;
  detailLoading = signal(false);
  detail = signal<ProdutoDetailResponse | null>(null);

  ngOnInit(): void {
    this.catalog.getFabricantes().subscribe((fabs) => {
      this.fabricanteOptions.set(fabs.map((f) => f.nome_fabricante));
    });
    this.catalog.getCategorias().subscribe((cats) => {
      const unique = Array.from(new Set(cats.map((c) => c.categoria_principal)));
      this.categoriaOptions.set(unique);
    });
    this.loadProdutos();
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadProdutos();
  }

  clearFilters(): void {
    this.search = '';
    this.selectedFabricante = '';
    this.selectedCategoria = '';
    this.page = 1;
    this.loadProdutos();
  }

  onPage(event: { first?: number | null; rows?: number | null }): void {
    const rows = event.rows || 15;
    const first = event.first || 0;
    this.limit = rows;
    this.page = Math.floor(first / rows) + 1;
    this.loadProdutos();
  }

  loadProdutos(): void {
    this.loading.set(true);
    this.catalog
      .getProdutos({
        search: this.search,
        fabricante: this.selectedFabricante || '',
        categoria: this.selectedCategoria || '',
        page: this.page,
        limit: this.limit,
      })
      .subscribe({
        next: (res) => {
          this.produtos.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  openDetail(id: string): void {
    this.detailVisible = true;
    this.detailLoading.set(true);
    this.detail.set(null);
    this.catalog.getProdutoById(id).subscribe({
      next: (res) => {
        this.detail.set(res);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }
}
