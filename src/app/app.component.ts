import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SpacesComponent } from "./componentes/spaces/spaces.component";
import { ReportsComponent } from "./componentes/reports/reports.component";
import { ArribaComponent } from "./componentes/arriba/arriba.component";


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SpacesComponent, ReportsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Gestión de Autolavado-Parking — Bosquejo';
}
