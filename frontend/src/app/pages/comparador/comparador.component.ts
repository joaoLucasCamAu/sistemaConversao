import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CatalogService } from '../../services/catalog.service';
import { ComparacaoResponse } from '../../models/catalog.models';

@Component({
  selector: 'app-comparador',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ButtonModule, TableModule, TagModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Comparador Técnico Lado a Lado</h1>
        <p class="text-sm text-slate-500">
          Selecione um produto concorrente e um produto candidato para comparar todos os atributos técnicos.
        </p>
      </div>

      <!-- Seleção -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div class="lg:col-span-5">
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">Produto Concorrente</label>
          <p-select
            [options]="produtoOptions()"
            optionLabel="label"
            optionValue="value"
            [filter]="true"
            [(ngModel)]="selectedConcorrente"
            placeholder="Selecione o produto concorrente"
            class="w-full"
          />
        </div>

        <div class="lg:col-span-5">
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">Produto Candidato</label>
          <p-select
            [options]="produtoOptions()"
            optionLabel="label"
            optionValue="value"
            [filter]="true"
            [(ngModel)]="selectedCandidato"
            placeholder="Selecione o produto candidato"
            class="w-full"
          />
        </div>

        <div class="lg:col-span-2">
          <p-button
            label="Comparar"
            icon="pi pi-sliders-h"
            (onClick)="executarComparacao()"
            [loading]="loading()"
            [disabled]="!selectedConcorrente || !selectedCandidato"
            styleClass="w-full"
          />
        </div>
      </div>

      @if (resultado()) {
        <!-- Resumo -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div class="text-xs font-semibold uppercase text-slate-400">Concorrente</div>
            <div class="text-base font-bold text-slate-900 mt-1">{{ resultado()!.concorrente.fabricante }}</div>
            <div class="font-mono text-xs text-slate-600">{{ resultado()!.concorrente.codigo_comercial }}</div>
            <div class="text-xs text-slate-500 mt-1">{{ resultado()!.concorrente.nome_produto }}</div>
          </div>

          <div class="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm bg-blue-50/30">
            <div class="text-xs font-semibold uppercase text-blue-500">Candidato</div>
            <div class="text-base font-bold text-blue-900 mt-1">{{ resultado()!.candidato.fabricante }}</div>
            <div class="font-mono text-xs text-blue-700">{{ resultado()!.candidato.codigo_comercial }}</div>
            <div class="text-xs text-slate-600 mt-1">{{ resultado()!.candidato.nome_produto }}</div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div class="text-xs font-semibold uppercase text-slate-400">Resumo da Matriz</div>
            <div class="mt-2 flex items-baseline gap-4">
              <div>
                <span class="text-2xl font-bold text-slate-900">{{ resultado()!.resumo.totalAtributos }}</span>
                <span class="text-xs text-slate-500 ml-1">atributos</span>
              </div>
              <div>
                <span class="text-2xl font-bold text-emerald-600">{{ resultado()!.resumo.iguais }}</span>
                <span class="text-xs text-slate-500 ml-1">idênticos</span>
              </div>
              <div>
                <span class="text-2xl font-bold text-amber-600">{{ resultado()!.resumo.obrigatorios }}</span>
                <span class="text-xs text-slate-500 ml-1">obrigatórios</span>
              </div>
            </div>
            @if (resultado()!.equivalencia) {
              <div class="mt-2">
                <p-tag
                  [value]="'Equivalência: ' + resultado()!.equivalencia!.status_da_equivalencia"
                  severity="info"
                />
              </div>
            }
          </div>
        </div>

        <!-- Matriz -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <p-table [value]="resultado()!.matrix" [tableStyle]="{ 'min-width': '56rem' }" styleClass="p-datatable-sm">
            <ng-template #header>
              <tr>
                <th>Atributo Técnico</th>
                <th>Obrigatório</th>
                <th>{{ resultado()!.concorrente.fabricante }} ({{ resultado()!.concorrente.codigo_comercial }})</th>
                <th>{{ resultado()!.candidato.fabricante }} ({{ resultado()!.candidato.codigo_comercial }})</th>
                <th>Aderência</th>
              </tr>
            </ng-template>
            <ng-template #body let-row>
              <tr [class.bg-amber-50/40]="row.obrigatorio">
                <td>
                  <div class="text-xs font-semibold text-slate-800">{{ row.nome_do_atributo }}</div>
                  @if (row.descricao) {
                    <div class="text-[11px] text-slate-400">{{ row.descricao }}</div>
                  }
                </td>
                <td>
                  <p-tag
                    [value]="row.obrigatorio ? 'Sim' : 'Não'"
                    [severity]="row.obrigatorio ? 'warn' : 'secondary'"
                  />
                </td>
                <td class="font-mono text-xs text-slate-700">
                  @if (row.concorrente) {
                    {{ row.concorrente.valor }}
                    <span class="text-slate-400">{{ row.concorrente.unidade !== '-' ? row.concorrente.unidade : '' }}</span>
                  } @else {
                    <span class="text-slate-300">—</span>
                  }
                </td>
                <td class="font-mono text-xs text-blue-700 font-medium">
                  @if (row.candidato) {
                    {{ row.candidato.valor }}
                    <span class="text-slate-400">{{ row.candidato.unidade !== '-' ? row.candidato.unidade : '' }}</span>
                  } @else {
                    <span class="text-slate-300">—</span>
                  }
                </td>
                <td>
                  @if (row.igual) {
                    <p-tag value="Igual" severity="success" />
                  } @else if (row.concorrente && row.candidato) {
                    <p-tag value="Divergente" severity="warn" />
                  } @else {
                    <p-tag value="Lacuna" severity="secondary" />
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>
  `,
})
export class ComparadorComponent implements OnInit {
  private catalog = inject(CatalogService);
  private route = inject(ActivatedRoute);

  produtoOptions = signal<{ label: string; value: string }[]>([]);
  selectedConcorrente = '';
  selectedCandidato = '';
  loading = signal(false);
  resultado = signal<ComparacaoResponse | null>(null);

  ngOnInit(): void {
    this.catalog.getProdutos({ limit: 500 }).subscribe((res) => {
      this.produtoOptions.set(
        res.items.map((p) => ({
          label: `${p.fabricante} | ${p.codigo_comercial} - ${p.nome_produto}`,
          value: p.id_produto,
        }))
      );
    });

    this.route.queryParams.subscribe((params) => {
      if (params['concorrente'] && params['candidato']) {
        this.selectedConcorrente = params['concorrente'];
        this.selectedCandidato = params['candidato'];
        this.executarComparacao();
      }
    });
  }

  executarComparacao(): void {
    if (!this.selectedConcorrente || !this.selectedCandidato) return;
    this.loading.set(true);
    this.catalog.compararProdutos(this.selectedConcorrente, this.selectedCandidato).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
