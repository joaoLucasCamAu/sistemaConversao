import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CatalogService } from '../../services/catalog.service';
import { Categoria, Fabricante } from '../../models/catalog.models';

@Component({
  selector: 'app-taxonomia',
  standalone: true,
  imports: [CommonModule, TabsModule, TableModule, TagModule],
  template: `
    <div class="space-y-5">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Fabricantes &amp; Categorias</h1>
        <p class="text-sm text-slate-500">
          Estrutura taxonômica do catálogo e atributos técnicos obrigatórios por família de equipamento.
        </p>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p-tabs value="0">
          <p-tablist>
            <p-tab value="0">Fabricantes ({{ fabricantes().length }})</p-tab>
            <p-tab value="1">Categorias &amp; Regras ({{ categorias().length }})</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="0">
              <p-table [value]="fabricantes()" [tableStyle]="{ 'min-width': '52rem' }" styleClass="p-datatable-sm">
                <ng-template #header>
                  <tr>
                    <th>ID</th>
                    <th>Fabricante</th>
                    <th>País</th>
                    <th>Atuação</th>
                    <th>Produtos</th>
                    <th>Site Oficial</th>
                  </tr>
                </ng-template>
                <ng-template #body let-f>
                  <tr>
                    <td class="font-mono text-xs text-slate-500">{{ f.id_fabricante }}</td>
                    <td class="text-xs font-bold text-slate-900">{{ f.nome_fabricante }}</td>
                    <td class="text-xs text-slate-600">{{ f.pais_origem }}</td>
                    <td class="text-xs text-slate-600">{{ f.categoria_de_atuacao }}</td>
                    <td><p-tag [value]="String(f.total_produtos || 0)" severity="info" /></td>
                    <td>
                      @if (f.site_oficial) {
                        <a
                          [href]="f.site_oficial"
                          target="_blank"
                          rel="noopener"
                          class="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          Acessar <i class="pi pi-external-link text-[10px]"></i>
                        </a>
                      }
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </p-tabpanel>

            <p-tabpanel value="1">
              <p-table [value]="categorias()" [tableStyle]="{ 'min-width': '60rem' }" styleClass="p-datatable-sm">
                <ng-template #header>
                  <tr>
                    <th>ID</th>
                    <th>Categoria Principal</th>
                    <th>Subcategoria</th>
                    <th>Tipo de Equipamento</th>
                    <th>Produtos</th>
                    <th>Atributos Técnicos Obrigatórios</th>
                  </tr>
                </ng-template>
                <ng-template #body let-c>
                  <tr>
                    <td class="font-mono text-xs text-slate-500">{{ c.id_categoria }}</td>
                    <td class="text-xs font-semibold text-slate-800">{{ c.categoria_principal }}</td>
                    <td class="text-xs text-slate-700">{{ c.subcategoria }}</td>
                    <td class="text-xs text-slate-500">{{ c.tipo_de_equipamento }}</td>
                    <td><p-tag [value]="String(c.total_produtos || 0)" severity="info" /></td>
                    <td class="text-xs text-slate-600 max-w-md">{{ c.atributos_tecnicos_obrigatorios }}</td>
                  </tr>
                </ng-template>
              </p-table>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      </div>
    </div>
  `,
})
export class TaxonomiaComponent implements OnInit {
  private catalog = inject(CatalogService);
  protected String = String;

  fabricantes = signal<Fabricante[]>([]);
  categorias = signal<Categoria[]>([]);

  ngOnInit(): void {
    this.catalog.getFabricantes().subscribe((res) => this.fabricantes.set(res));
    this.catalog.getCategorias().subscribe((res) => this.categorias.set(res));
  }
}
