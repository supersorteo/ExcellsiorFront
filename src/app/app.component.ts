import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SpacesComponent } from "./componentes/spaces/spaces.component";
import { ReportsComponent } from "./componentes/reports/reports.component";
import { ArribaComponent } from "./componentes/arriba/arriba.component";
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SpacesComponent, ReportsComponent, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Gestión de Autolavado-Parking — Bosquejo';
  isLoggedIn = false;
  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;
  showPassword = false;
  isCheckingAuth = true;
  private apiUrl = "http://localhost:8080";
  constructor(private http: HttpClient) {


    const saved = localStorage.getItem('auth');
    if (saved) {
      const auth = JSON.parse(saved);
      this.tryLogin(auth.username, auth.password, true);
    } else {
      this.isCheckingAuth = false; // No hay credenciales → mostrar login directamente
    }

  }

  login() {
    if (!this.username || !this.password) {
      this.errorMessage = 'Ingresá usuario y contraseña';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.tryLogin(this.username, this.password);
  }

  private tryLogin0(username: string, password: string, silent: boolean = false) {
    const authHeader = 'Basic ' + btoa(username + ':' + password);

    this.http.get(`${this.apiUrl}/api/auth/users`, {
      headers: { Authorization: authHeader }
    }).subscribe({
      next: () => {
        // Login exitoso
        this.isLoggedIn = true;
        //localStorage.setItem('auth', JSON.stringify({ username, password }));
         localStorage.setItem('auth', JSON.stringify({ username }));
       /* if (!silent) {
          alert('¡Bienvenido!');
        }*/
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Usuario o contraseña incorrectos';
        localStorage.removeItem('auth');
      }
    });
  }

  private tryLogin(username: string, password: string, silent: boolean = false) {
    if (!silent) {
      this.isLoading = true;
      this.errorMessage = '';
    }

    const authHeader = 'Basic ' + btoa(username + ':' + password);

    this.http.get(`${this.apiUrl}/api/auth/users`, {
      headers: { Authorization: authHeader }
    }).subscribe({
      next: () => {
        this.isLoggedIn = true;
        this.isCheckingAuth = false;
        this.username = username;
        localStorage.setItem('auth', JSON.stringify({ username, password }));
       /* if (!silent) {
          alert('¡Bienvenido de nuevo!');
        }*/
      },
      error: (err) => {
        this.isLoading = false;
        this.isCheckingAuth = false;
        this.errorMessage = 'Sesión expirada o credenciales inválidas. Iniciá sesión nuevamente.';
        localStorage.removeItem('auth');
      }
    });
  }

  logout() {
    this.isLoggedIn = false;
    localStorage.removeItem('auth');
    this.username = '';
    this.password = '';
    this.isLoading = false;
  }

}
