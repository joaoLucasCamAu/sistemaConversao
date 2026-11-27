import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  mobileMenuOpen = false;

  navItems = [
    { label: 'Dashboard', icon: 'pi pi-chart-bar', route: '/dashboard' },
    { label: 'Catálogo de Produtos', icon: 'pi pi-box', route: '/produtos' },
    { label: 'Equivalências', icon: 'pi pi-arrows-h', route: '/equivalencias' },
    { label: 'Comparador Técnico', icon: 'pi pi-sliders-h', route: '/comparador' },
    { label: 'Fabricantes & Categorias', icon: 'pi pi-sitemap', route: '/taxonomia' },
  ];
}
