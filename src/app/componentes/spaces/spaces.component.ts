import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Subject, takeUntil, combineLatest, BehaviorSubject, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';
import { Client, Space, Subsuelo, VehicleType } from '../../models/autolavado.model';
import { AutolavadoService } from '../../services/autolavado.service';
import { QrService } from '../../services/qr.service';

declare var bootstrap: any;

@Component({
  selector: 'app-spaces',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl:'./spaces.component.html',
  styleUrls: ['./spaces.component.scss']
})

export class SpacesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('occQRElm', { static: false }) occQRContainer!: ElementRef<HTMLDivElement>;
  private searchTermSubject = new BehaviorSubject<string>('');
  newSpaceKey = '';
  selectedNewSubsuelo = '';
  subsuelos: Subsuelo[] = [];
  spaces: { [key: string]: Space } = {};
  clients: { [key: string]: Client } = {};
  currentSubId: string | null = null;
  currentSubTitle = 'Espacios';
  filteredSpaces: Space[] = [];
  searchTerm = '';
  addSpacesCount = 5;
  isClientsDbOpen = false;


  allClients: Client[] = [];
  searchTermClients = '';
  filteredClientsAdmin: Client[] = [];
  //editedSpace: any = {}; // Nueva propiedad para datos del espacio editado
  editedSpace: Space | null = null;
  currentPage: number = 1;
  itemsPerPage: number = 14;

  // Modal data
  selectedSpaceKey = '';
  selectedSpace: Space | null = null;
  selectedClient: Client | null = null;
  showQR = false;
  showOccupiedQR = false;
  qrCaption = '';
  whatsappLink = '';

  clientForm: FormGroup;
  editedSubsueloLabel = '';

  whatsappMessage: string = '';

  showWhatsAppModal: boolean = false;

  hasCopiedMessage: boolean = false;

  showWhatsAppModalOccupied = false;
  whatsappMessageOccupied = '';
  hasCopiedMessageOccupied = false;


vehicles: VehicleType[] = [];
existingClientId: any | null = null;
horaCierreAutomatico = '23:59';
  constructor(
    private autolavadoService: AutolavadoService,
    private qrService: QrService,
    private fb: FormBuilder,
     private cdr: ChangeDetectorRef
  ) {
    this.clientForm = this.fb.group({
      name: ['', Validators.required],
      dni: ['', [Validators.required, Validators.pattern('[0-9]{7,8}')]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{8,10}$/)]],
      vehicle: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(1)]],
      plate: [''],
      notes: ['']
    });
  }

 /* ngOnInit(): void {
    combineLatest([
      this.autolavadoService.subsuelos$,
      this.autolavadoService.spaces$,
      this.autolavadoService.clients$,
      this.autolavadoService.currentSubId$,
      this.searchTermSubject
    ]).pipe(takeUntil(this.destroy$))
    .subscribe(([subsuelos, spaces, clients, currentSubId]) => {
      this.subsuelos = subsuelos;
      this.spaces = spaces;
      this.clients = clients;
      this.currentSubId = currentSubId;
      this.updateCurrentSubTitle();
      this.filterSpaces();
    });

    // Suscripción reactiva a searchTerm
  this.searchTermSubject.subscribe(() => {
    this.currentPage = 1;
    this.filterSpaces();
  });

    // Timer para actualizar tiempos transcurridos
    setInterval(() => {
      // Forzar actualización de la vista cada minuto
      this.cdr.detectChanges();
    }, 60000);

this.autolavadoService.loadVehicleTypes().subscribe({
    next: (vehicles: VehicleType[]) => {
      this.vehicles = vehicles;
      console.log('Tipos de vehículos cargados:', vehicles);
    },
    error: (err) => {
      console.error('Error al cargar vehículos', err);
      alert('No se pudieron cargar los tipos de vehículos');
    }
  });



  }*/

ngOnInit(): void {
  // 1. VERIFICAR SI HAY DATOS EN LOCALSTORAGE
  const localSubsuelos = localStorage.getItem('subsuelos');
  const localSpaces = localStorage.getItem('spaces');

  if (!localSubsuelos || !localSpaces || JSON.parse(localSubsuelos).length === 0) {
    console.log('LocalStorage vacío → cargando desde backend como respaldo');
    this.loadDataFromBackend();
  } else {
    console.log('Datos encontrados en localStorage → usando local');
    // Aquí NO llamamos a ningún método → el servicio ya cargó los datos al iniciar
    // (tu servicio probablemente los carga en el constructor o al instanciarse)
  }

  // 2. SUSCRIPCIONES REACTIVAS (igual que antes)
  combineLatest([
    this.autolavadoService.subsuelos$,
    this.autolavadoService.spaces$,
    this.autolavadoService.clients$,
    this.autolavadoService.currentSubId$,
    this.searchTermSubject
  ]).pipe(takeUntil(this.destroy$))
  .subscribe(([subsuelos, spaces, clients, currentSubId]) => {
    this.subsuelos = subsuelos;
    this.spaces = spaces;
    this.clients = clients;
    this.currentSubId = currentSubId;
    this.updateCurrentSubTitle();
    this.filterSpaces();
  });

  this.searchTermSubject.subscribe(() => {
    this.currentPage = 1;
    this.filterSpaces();
  });

  setInterval(() => {
    this.cdr.detectChanges();
  }, 60000);

  // 3. CARGAR VEHÍCULOS DESDE BACKEND (siempre)
  this.autolavadoService.loadVehicleTypes().subscribe({
    next: (vehicles: VehicleType[]) => {
      this.vehicles = vehicles;
      console.log('Tipos de vehículos cargados desde backend:', vehicles);
    },
    error: (err) => {
      console.error('Error al cargar vehículos', err);
      alert('No se pudieron cargar los tipos de vehículos');
    }
  });



  this.clientForm.get('dni')?.valueChanges
    .pipe(
      debounceTime(600),
      distinctUntilChanged()
    )
    .subscribe(dni => {
      if (dni && dni.length >= 7) {
        this.autolavadoService.searchClientByDni(dni).subscribe({
          next: (client) => {
            if (client) {
              // Cliente encontrado → autocompletar + guardar ID real
              this.existingClientId = client.id;

              this.clientForm.patchValue({
                name: client.name || '',
                phone: client.phoneRaw || '',
                plate: client.plate || '',
                notes: client.notes || '',
                vehicle: client.vehicle || ''
              });

              if (client.price) {
                this.clientForm.get('price')?.setValue(client.price);
              }

              console.log('Cliente encontrado por DNI:', client);
            } else {
              this.existingClientId = null;  // Nuevo cliente
            }
          },
          error: () => {
            this.existingClientId = null;
          }
        });
      } else {
        this.existingClientId = null;
      }
    });

  this.iniciarCierreAutomatico();


}

cerrarDiaAutomatico(): void {
  const hoy = new Date().toLocaleDateString('es-AR');
  console.log(`Cierre automático del día ${hoy}`);

  // Opcional: sin confirmación (fully automático)
  this.autolavadoService.resetData().subscribe({
    next: () => {
      console.log('Cierre automático completado: todo limpiado');
      this.filterSpaces();
      this.cdr.detectChanges();
      // Opcional: mostrar notificación
      //alert(`Cierre automático: Día ${hoy} cerrado.\nListo para mañana.`);
    },
    error: (err: any) => {
      console.warn('Error en cierre automático', err);
    }
  });
}

iniciarCierreAutomatico(): void {
  setInterval(() => {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    if (currentTime === this.horaCierreAutomatico) {
      console.log(`Hora de cierre automático: ${currentTime}`);
      this.cerrarDiaAutomatico();
    }
  }, 60000); // Cada minuto
}

// NUEVO MÉTODO: Cargar subsuelos y espacios desde backend si localStorage vacío
private loadDataFromBackend0(): void {
  forkJoin({
    subsuelos: this.autolavadoService.loadSubsuelosFromBackend(),
    spaces: this.autolavadoService.loadSpacesFromBackend()
  }).subscribe({
    next: ({ subsuelos, spaces }) => {
      console.log('Datos cargados desde backend como respaldo');

      // Convertir array de spaces a objeto con key
      const spacesObj: { [key: string]: Space } = {};
      spaces.forEach(s => {
        spacesObj[s.key] = s;
      });

      // ACTUALIZAR LOS BEHAVIOR SUBJECTS DEL SERVICIO
      this.autolavadoService.subsuelosSubject.next(subsuelos);
      this.autolavadoService.spacesSubject.next(spacesObj);

      // Guardar en localStorage para próxima vez
      this.autolavadoService.saveAll();

      // Establecer subsuelo actual
      if (subsuelos.length > 0) {
        this.autolavadoService.currentSubIdSubject.next(subsuelos[0].id);
      }
    },
    error: (err) => {
      console.error('Error cargando datos desde backend', err);
      alert('No hay datos en servidor ni local. Creando subsuelo inicial...');
      // Crear primer subsuelo si todo falla
      this.autolavadoService.addSubsuelo();
    }
  });
}


private loadDataFromBackend(): void {
  forkJoin({
    subsuelos: this.autolavadoService.loadSubsuelosFromBackend(),
    spaces: this.autolavadoService.loadSpacesFromBackend(),
    clients: this.autolavadoService.loadClientsFromBackend()  // ← NUEVO
  }).subscribe({
    next: ({ subsuelos, spaces, clients }) => {
      console.log('Datos cargados desde backend como respaldo');

      // Convertir spaces a mapa
      const spacesObj: { [key: string]: Space } = {};
      spaces.forEach(s => spacesObj[s.key] = s);

      // Convertir clients a mapa por ID real
      const clientsMap: { [key: string]: Client } = {};
      clients.forEach(c => clientsMap[c.id.toString()] = c);

      // ACTUALIZAR TODOS LOS SUBJECTS DEL SERVICIO
      this.autolavadoService.subsuelosSubject.next(subsuelos);
      this.autolavadoService.spacesSubject.next(spacesObj);
      this.autolavadoService.clientsSubject.next(clientsMap);  // ← NUEVO

      // Guardar todo en localStorage (sobrescribe lo viejo)
      this.autolavadoService.saveAll();

      // Establecer subsuelo actual
      if (subsuelos.length > 0) {
        this.autolavadoService.currentSubIdSubject.next(subsuelos[0].id);
      }

      console.log('Datos sincronizados desde backend → localStorage actualizado');
    },
    error: (err) => {
      console.error('Error cargando datos desde backend', err);
      alert('No hay conexión. Usando datos locales si existen...');
      // Si falla, el servicio ya cargó lo que había en localStorage
    }
  });
}

// NUEVO MÉTODO: Cargar subsuelos y espacios desde backend como respaldo
openClientsAdminModal(): void {
  this.loadAllClientsFromBackend();
  const modal = new bootstrap.Modal(document.getElementById('clientsAdminModal')!);
  modal.show();
}

openClientsDb(): void {
  this.isClientsDbOpen = true;
  this.loadAllClientsFromBackend();
}

closeClientsDb(): void {
  this.isClientsDbOpen = false;
  this.searchTermClients = '';
  this.filteredClientsAdmin = [];
}


filterClientsAdmin(): void {
  if (!this.searchTermClients.trim()) {
    this.filteredClientsAdmin = this.allClients;
    return;
  }

  const term = this.searchTermClients.toLowerCase();
  this.filteredClientsAdmin = this.allClients.filter(client =>
    (client.name?.toLowerCase().includes(term)) ||
    (client.dni?.includes(term)) ||
    (client.phoneIntl?.includes(term)) ||
    (client.vehicle?.toLowerCase().includes(term)) ||
    (client.plate?.toLowerCase().includes(term)) ||
    (client.code?.toLowerCase().includes(term))
  );
}

clearSearchClients(): void {
  this.searchTermClients = '';
  this.filteredClientsAdmin = this.allClients;
}

loadAllClientsFromBackend0(): void {
  this.autolavadoService.getAllClientsFromBackend().subscribe({
    next: (clients) => {
      this.allClients = clients;
      console.log('Todos los clientes cargados desde backend:', clients);
    },
    error: (err) => {
      console.error('Error cargando clientes desde backend', err);
      alert('No se pudieron cargar los clientes');
    }
  });
}

loadAllClientsFromBackend(): void {
  this.autolavadoService.getAllClientsFromBackend().subscribe({
    next: (clients) => {
      this.allClients = clients;
      this.filteredClientsAdmin = clients;
      console.log('Todos los clientes cargados desde backend:', clients);
    },
    error: (err) => {
      console.error('Error cargando clientes', err);
      alert('No se pudieron cargar los clientes');
    }
  });
}

getSpaceByKey(spaceKey: string | null): Space | undefined {
  if (!spaceKey) return undefined;
  return this.autolavadoService.spacesSubject.value[spaceKey];
}

formatDateOnly(startTime: number | null): string {
  if (!startTime) return '-';
  const date = new Date(startTime);
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

formatStartTime(startTime: number | null): string {
  if (!startTime) return '-';
  const date = new Date(startTime);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + ', ' + date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  }) + ' hs';
}

getTimeInSpace(startTime: number | null): string {
  if (!startTime) return '-';
  const diff = Date.now() - startTime;

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours > 0) {
    return `Hace ${hours}h ${minutes}min`;
  } else {
    return `Hace ${minutes}min`;
  }
}

editClient(client: Client): void {
  alert(`Función editar cliente ID ${client.id} - Puedes implementar un formulario aquí`);
  console.log('Editar cliente:', client);
  // Aquí puedes abrir otro modal con formulario para editar
}

deleteClient0(clientId: any): void {
  if (confirm(`¿Eliminar cliente ID ${clientId}? Esta acción es irreversible.`)) {
    this.autolavadoService.deleteClientFromBackend(clientId).subscribe({
      next: () => {
        this.allClients = this.allClients.filter(c => c.id !== clientId);
        console.log(`Cliente ${clientId} eliminado del backend`);
        alert('Cliente eliminado correctamente');
      },
      error: (err) => {
        console.error('Error eliminando cliente', err);
        alert('Error al eliminar cliente');
      }
    });
  }
}

deleteClient1(clientId: any): void {
  if (confirm(`¿Eliminar cliente ID ${clientId}? Esto liberará el espacio que ocupa (si lo tiene).`)) {
    console.log('Iniciando eliminación del cliente ID:', clientId);

    this.autolavadoService.deleteClientFromBackend(clientId).subscribe({
      next: () => {
        console.log(`Cliente ${clientId} eliminado del backend`);

        // Actualizar tabla admin
        this.allClients = this.allClients.filter(c => c.id !== clientId);

        // RECARGAR ESPACIOS DESDE BACKEND para reflejar liberación
        this.autolavadoService.loadSpacesFromBackend().subscribe({
          next: (spacesFromBackend) => {
            console.log('Espacios recargados desde backend después de eliminar cliente');

            // Convertir a mapa
            const spacesMap: { [key: string]: Space } = {};
            spacesFromBackend.forEach(space => spacesMap[space.key] = space);

            // Actualizar subjects
            this.autolavadoService.spacesSubject.next(spacesMap);
            this.autolavadoService.saveAll();

            // Actualizar grid principal
            this.filterSpaces();
            this.cdr.detectChanges();

            console.log('Grid de espacios actualizada con datos frescos del backend');
          },
          error: (err) => console.warn('Error recargando espacios desde backend', err)
        });

        alert('Cliente eliminado correctamente');
      },
      error: (err) => {
        console.error('Error eliminando cliente', err);
        alert('Error al eliminar cliente');
      }
    });
  }
}

deleteClient(clientId: any): void {
  if (confirm(`¿Eliminar cliente ID ${clientId}? Esto liberará el espacio que ocupa (si lo tiene).`)) {
    console.log('Iniciando eliminación del cliente ID:', clientId);

    this.autolavadoService.deleteClientFromBackend(clientId).subscribe({
      next: () => {
        console.log(`Cliente ${clientId} eliminado correctamente`);

        // Actualizar tabla admin (si estás en panel admin)
        this.allClients = this.allClients.filter(c => c.id !== clientId);

        // Actualizar grid principal y tabla "Servicios del día"
        this.filterSpaces();
        this.cdr.detectChanges();

        alert('Cliente eliminado correctamente');
      },
      error: (err) => {
        console.error('Error eliminando cliente', err);
        alert('Error al eliminar cliente');
      }
    });
  }
}



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateCurrentSubTitle(): void {
    const sub = this.subsuelos.find(s => s.id === this.currentSubId);
    this.currentSubTitle = `Espacios — ${sub?.label || this.currentSubId || ''}`;
  }





private filterSpaces(): void {
  if (!this.currentSubId) {
    this.filteredSpaces = [];
    return;
  }

  let allSpaces = Object.values(this.spaces)
    .filter(sp => sp.subsueloId === this.currentSubId);

  // Filtrar solo por displayName y key si searchTerm existe
  const currentSearchTerm = this.searchTermSubject.value.trim();
  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    allSpaces = allSpaces.filter(space => {
      return (
        (space.displayName || '').toLowerCase().includes(term) ||
        space.key.toLowerCase().includes(term)
      );
    });
  }

  // Ordenar alfabéticamente por key
  allSpaces = allSpaces.sort((a, b) => a.key.localeCompare(b.key));

  // Paginación
  const startIndex = (this.currentPage - 1) * this.itemsPerPage;
  const endIndex = startIndex + this.itemsPerPage;
  this.filteredSpaces = allSpaces.slice(startIndex, endIndex);
}



  onSubsueloChange(): void {
    if (this.currentSubId) {
      this.autolavadoService.setCurrentSubsuelo(this.currentSubId);
    }
  }

  addSubsuelo(): void {
    this.autolavadoService.addSubsuelo();
  }



editSubsuelo(): void {
  if (this.currentSubId) {
    const currentSub = this.subsuelos.find(sub => sub.id === this.currentSubId);
    this.editedSubsueloLabel = currentSub?.label || '';
    this.showModal('editSubsueloModal');
  }
}

confirmEditSubsuelo(): void {
  if (this.editedSubsueloLabel.trim() && this.currentSubId) {
    try {
      this.autolavadoService.updateSubsuelo(this.currentSubId, this.editedSubsueloLabel);
      this.filterSpaces(); // Actualizar vista
      this.cdr.detectChanges();
      alert('Subsuelo actualizado exitosamente!');
    } catch (error) {
      alert('Error al actualizar subsuelo: ' + error);
    }
  }
  this.hideModal('editSubsueloModal');
}


  addSpaces(): void {
    this.autolavadoService.addSpacesToCurrent(this.addSpacesCount);
  }




onSearch(): void {

this.searchTermSubject.next(this.searchTerm); // Actualizar subject para reactividad
  this.currentPage = 1;
}

  isSearchHit(space: Space): boolean {
    if (!this.searchTerm.trim()) return false;

    const term = this.searchTerm.trim().toLowerCase();
    const client = this.clients[space.clientId || ''];

    return space.key.toLowerCase().includes(term) ||
           (client && (
             (client.name || '').toLowerCase().includes(term) ||
             (client.phoneRaw || '').replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
             (client.vehicle || '').toLowerCase().includes(term) ||
             (client.plate || '').toLowerCase().includes(term)
           ));
  }



  getElapsed(startTime: number | null | undefined): string {
  return this.autolavadoService.elapsedFrom(startTime);
}

getFormattedDate(timestamp: number | null | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '-';
}

  onSpaceClick0(space: Space): void {
    this.selectedSpaceKey = space.key;
    this.selectedSpace = space;
    this.showQR = false;
    this.showOccupiedQR = false;

    if (space.occupied) {
      // Mostrar modal de ocupado
      this.selectedClient = this.clients[space.clientId!];
      if (this.selectedClient) {
        this.whatsappLink = this.autolavadoService.buildWhatsAppLink(this.selectedClient, space);
        this.qrCaption = `${this.selectedClient.name} — ${this.selectedClient.code}`;
      }
      this.showModal('occupiedModal');
    } else {
      // Mostrar modal de cliente
      this.clientForm.reset();
      this.whatsappLink = '';
      this.showModal('clientModal');
    }
  }

  onSpaceClick(space: Space): void {
  this.selectedSpaceKey = space.key;
  this.selectedSpace = space;
  this.showQR = false;
  this.showOccupiedQR = false;

  if (space.occupied) {
    // Buscar cliente local primero
    let client = this.clients[space.clientId!];

    // Si no está en local, cargarlo desde backend
    if (!client && space.clientId) {
      this.autolavadoService.getClientFromBackend(space.clientId).subscribe({
        next: (serverClient) => {
          client = serverClient;
          this.selectedClient = client;
          this.updateOccupiedModal(client, space);
        },
        error: (err) => {
          console.warn('No se pudo cargar cliente desde backend', err);
          this.selectedClient = null;
        }
      });
    } else {
      this.selectedClient = client;
      this.updateOccupiedModal(client, space);
    }

    this.showModal('occupiedModal');
  } else {
    this.clientForm.reset();
    this.whatsappLink = '';
    this.showModal('clientModal');
  }
}

private updateOccupiedModal(client: Client | null, space: Space): void {
  if (client) {
    this.whatsappLink = this.autolavadoService.buildWhatsAppLink(client, space);
    this.qrCaption = `${client.name} — ${client.code}`;
  } else {
    this.whatsappLink = '';
    this.qrCaption = '';
  }
}









saveClient(): void {
  if (this.clientForm.invalid) {
    alert('Por favor completa todos los campos obligatorios.');
    return;
  }

  try {
    const selectedVehicleModel = this.clientForm.value.vehicle;
    const selectedVehicle = this.vehicles.find(v => v.model === selectedVehicleModel);

    const category = selectedVehicle?.category || 'AUTO';
    const price = this.clientForm.value.price || selectedVehicle?.price || 35000;

    const localClientData = {
      ...this.clientForm.value,
      category,
      price
    };

    // GUARDAR EN LOCAL (genera tempId)
    const localClient = this.autolavadoService.saveClient(localClientData, this.selectedSpaceKey);
    const space = this.spaces[this.selectedSpaceKey];

    this.whatsappMessage = this.autolavadoService.buildWhatsAppMessage(localClient, space);
    this.whatsappLink = this.autolavadoService.buildWhatsAppLink(localClient, space);

    this.hasCopiedMessage = false;

    // DATOS PARA BACKEND
    const payload = {
      id: this.existingClientId || null,
      name: localClient.name,
      dni: localClient.dni || '',
      phoneRaw: localClient.phoneRaw,
      phoneIntl: localClient.phoneIntl,
      code: localClient.code,
      vehicle: localClient.vehicle,
      plate: localClient.plate,
      notes: localClient.notes,
      category: localClient.category,
      price: localClient.price,
      vehicleType: selectedVehicle ? { id: selectedVehicle.id } : null
    };

    console.log('Datos enviados al backend:', payload);

    this.autolavadoService.saveClientToBackend({
      spaceKey: this.selectedSpaceKey,
      payload: payload
    }).subscribe({
      next: (serverClient) => {
        console.log('Cliente reservado/actualizado en backend:', serverClient);

        const tempId = localClient.id;
        const realId = serverClient.id.toString();

        const clientsMap = this.autolavadoService.clientsSubject.value;

        // ELIMINAR tempId y GUARDAR con ID real como clave
        if (clientsMap[tempId]) {
          const clientToMove = { ...clientsMap[tempId], id: realId };
          delete clientsMap[tempId];
          clientsMap[realId] = clientToMove;

          this.autolavadoService.clientsSubject.next({ ...clientsMap });
          console.log(`Cliente movido de tempId ${tempId} a realId ${realId}`);
        }

        // Actualizar espacio con ID real
        space.clientId = realId;
        this.autolavadoService.spacesSubject.next({ ...this.spaces });

        // Guardar en localStorage con estructura correcta
        this.autolavadoService.saveAll();

        // Actualizar vista
        //this.calculateStats();
        this.filterSpaces();
        this.cdr.detectChanges();

        alert('Cliente guardado exitosamente!');
      },
      error: (err) => {
        console.warn('Error en backend (funciona offline)', err);
      }
    });
  } catch (error) {
    console.error('Error:', error);
    alert('Error al guardar cliente: ' + error);
  }
}

onVehicleSelected(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const selectedModel = select.value;

  if (!selectedModel) {
    this.clientForm.patchValue({ price: 0 });
    return;
  }

  const selectedVehicle = this.vehicles.find(v => v.model === selectedModel);

  if (selectedVehicle) {
    // Carga el precio por defecto
    this.clientForm.patchValue({ price: selectedVehicle.price });

    console.log('🚗 Vehículo seleccionado:', {
      modelo: selectedVehicle.model,
      categoria: selectedVehicle.category,
      precioPorDefecto: selectedVehicle.price
    });
  }
}


   openWhatsApp0(): void {
    if (this.whatsappLink) {
      window.location.href = this.whatsappLink;
    }
  }

  openWhatsApp2(): void {
  if (this.whatsappLink) {
    // Descargar QR antes de abrir WhatsApp
    this.qrService.downloadQR('qrcode', `${this.qrCaption}.png`);
    window.open(this.whatsappLink, '_blank'); // Abrir en nueva pestaña para attach manual
  }
}

openWhatsApp(): void {
  this.showWhatsAppModal = true;
}

closeWhatsAppModal(): void {
  this.showWhatsAppModal = false;
}




copyMessage0(): void {
  navigator.clipboard.writeText(this.whatsappMessage).then(() => {
    this.hasCopiedMessage = true;
    alert('Mensaje copiado al portapapeles');
  });
}

copyMessage(): void {
  navigator.clipboard.writeText(this.whatsappMessage).then(() => {
    this.hasCopiedMessage = true;
    // Activar toast
    const toastEl = document.getElementById('copyToast');
    if (toastEl) {
      const toast = new bootstrap.Toast(toastEl);
      toast.show();
    }
  }).catch(err => {
    console.error('Error copying message:', err);
    // Fallback alert si clipboard falla
    alert('Error al copiar mensaje');
  });
}

launchWhatsApp(): void {
  if (this.whatsappLink) {
    this.qrService.downloadQR('qrcode', `${this.qrCaption}.png`);
    window.open(this.whatsappLink, '_blank');
    // this.closeWhatsAppModalOccupied();

    this.hasCopiedMessageOccupied = false
    // No cerramos el modal aquí
  }
}



launchWhatsAppOccupied(): void {
  if (this.whatsappLink) {
    //this.qrService.downloadQR('qrcode', `${this.qrCaption}.png`);
    window.open(this.whatsappLink, '_blank');


  }
}

 downloadQR(): void {
    this.qrService.downloadQR('qrcode', `cliente_${this.selectedSpaceKey, this.qrCaption}.png`);

  }

  downloadOccupiedQR(): void {
    this.qrService.downloadQR('occQRElm', `cliente_${this.selectedClient?.code, this.qrCaption || 'cliente'}.png`);
  }



// En tu componente .ts
openWhatsApp1(): void {
  if (this.whatsappLink) {
    // Primero descargar QR
    this.qrService.downloadQR('qrcode', `${this.qrCaption}.png`);

    // Pequeño delay para que termine la descarga
    setTimeout(() => {
      // Abrir WhatsApp en la misma ventana para mejor experiencia
      window.location.href = this.whatsappLink;

      // Alternativa: abrir en nueva pestaña
      // window.open(this.whatsappLink, '_blank', 'noopener,noreferrer');
    }, 100);
  } else {
    alert('No se pudo generar el link de WhatsApp');
  }
}

  toggleQR(): void {
    this.showQR = !this.showQR;
    if (this.showQR && this.clientForm.valid) {
      // Generar QR previo con datos actuales
      const tempClient = {
        id: 'temp',
        code: 'PREVIA',
        name: this.clientForm.value.name || '—',
        phone: `+${this.autolavadoService.toPhoneAR(this.clientForm.value.phone)}`
      };
      const fakeSpace = {
        key: this.selectedSpaceKey,
        subsuelo: this.selectedSpaceKey.split('-')[0]
      };
      const tempQR = JSON.stringify({
        t: 'autolavado-ticket',
        client: tempClient,
        space: fakeSpace,
        start: Date.now()
      });

      this.qrService.generateQR('qrcode', tempQR);
      this.qrCaption = `${tempClient.name} — ${tempClient.code}`;
    }
  }



toggleOccupiedQR(): void {
  this.showOccupiedQR = !this.showOccupiedQR;
  if (this.showOccupiedQR && this.selectedClient) {
    console.log('toggleOccupiedQR: Generando QR para', this.selectedClient.qrText);
    // Esperar renderizado completo del modal
    setTimeout(() => {
      const container = document.getElementById('occQRElm');
      if (container) {
        this.qrService.generateQR('occQRElm', this.selectedClient!.qrText);
        console.log('QR generado para occupied modal');
      } else {
        console.error('Container #occQRElm no encontrado - Modal no renderizado aún');
        // Reintento si no está listo
        setTimeout(() => {
          const retryContainer = document.getElementById('occQRElm');
          if (retryContainer) {
            this.qrService.generateQR('occQRElm', this.selectedClient!.qrText);
            console.log('QR generado en reintento');
          }
        }, 200);
      }
    }, 600); // Aumentar delay para modal Bootstrap
  }
}


  releaseSpace0(): void {
    if (confirm(`¿Liberar espacio ${this.selectedSpaceKey}?`)) {
      this.autolavadoService.releaseSpace(this.selectedSpaceKey);
      this.hideModal('occupiedModal');
    }
  }

  releaseSpace(): void {
  if (confirm(`¿Liberar espacio ${this.selectedSpace?.displayName || this.selectedSpaceKey}?`)) {
    this.autolavadoService.releaseSpace(this.selectedSpaceKey).subscribe({
      next: () => {
        console.log('Espacio liberado y datos sincronizados');
        this.filterSpaces();
        this.cdr.detectChanges();
        this.hideModal('occupiedModal');
        alert('Espacio liberado correctamente');
      },
      error: (err) => {
        console.warn('Error liberando espacio', err);
        alert('Liberado localmente. Se sincronizará con conexión.');
        this.hideModal('occupiedModal');
      }
    });
  }
}

  private showModal(modalId: string): void {
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
  }

  private hideModal(modalId: string): void {
    const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
    if (modal) {
      modal.hide();
    }
  }



  resetData(): void {
  if (confirm('Esto borrará todos los datos de clientes.')) {
    this.autolavadoService.resetData();
    this.filterSpaces();
    this.cdr.detectChanges();
  }
}

cerrarDia0(): void {
  const hoy = new Date().toLocaleDateString('es-AR');
  if (confirm(`¿Cerrar el día ${hoy}?\n\nEsto hará:\n• Liberar todos los espacios\n• Eliminar todos los clientes del día\n• Limpiar la base de datos\n\n¡No se podrá deshacer!`)) {
    console.log('Cerrando día y limpiando todo...');

    this.autolavadoService.resetData().subscribe({
      next: () => {
        console.log('Día cerrado: todo limpiado local y backend');
        this.filterSpaces();
        this.cdr.detectChanges();
        alert(`Día ${hoy} cerrado correctamente.\nListo para mañana.`);
      },
      error: (err: any) => {
        console.warn('Error cerrando día en backend', err);
        alert('Cerrado localmente. Se sincronizará cuando haya conexión.');
      }
    });
  }
}

cerrarDia(): void {
  const hoy = new Date().toLocaleDateString('es-AR');
  if (confirm(`¿Cerrar el día ${hoy}?\n\nEsto liberará todos los espacios.\nLos clientes se mantendrán en el histórico.\n\n¿Continuar?`)) {
    console.log('Iniciando cierre del día...');

    this.autolavadoService.resetData().subscribe({
      next: () => {
        console.log('Día cerrado correctamente');

        // Actualizar vista
        this.filterSpaces();
        this.cdr.detectChanges();

        alert(`Día ${hoy} cerrado.\nTodos los espacios están libres.\nDatos sincronizados con el servidor.`);
      },
      error: (err) => {
        console.warn('Error en el cierre del día', err);
        alert('Cerrado localmente. Intentá de nuevo cuando haya conexión.');
      }
    });
  }
}


 deleteSpace(): void {
    if (confirm(`¿Eliminar espacio ${this.selectedSpaceKey}?`)) {
      try {
        this.autolavadoService.deleteSpace(this.selectedSpaceKey);
        this.hideModal('clientModal');
      } catch (error) {
        alert('Error al eliminar espacio: ' + error);
      }
    }
  }




deleteSubsuelo(): void {
  if (this.currentSubId && confirm(`¿Eliminar subsuelo ${this.currentSubId}?`)) {
    try {
      this.autolavadoService.deleteSubsuelo(this.currentSubId);
    } catch (error) {
      alert('Error al eliminar subsuelo: ' + error);
    }
  }
}

deleteSpaces(): void {
  if (this.currentSubId && confirm(`¿Eliminar ${this.addSpacesCount} espacios del subsuelo ${this.currentSubId}?`)) {
    try {
      this.autolavadoService.deleteSpacesFromCurrent(this.addSpacesCount);
      this.filterSpaces();
      this.cdr.detectChanges();
      this.currentPage = 1;
    } catch (error) {
      alert('Error al eliminar espacios: ' + error);
    }
  }
}



get totalPages(): number {
  if (!this.currentSubId) return 1;
  const totalSpaces = Object.values(this.spaces)
    .filter(sp => sp.subsueloId === this.currentSubId)
    .length;
  return Math.ceil(totalSpaces / this.itemsPerPage);
}

goToPage(page: number): void {
  if (page >= 1 && page <= this.totalPages) {
    this.currentPage = page;
    this.filterSpaces();
    this.cdr.detectChanges();
  }
}

nextPage(): void {
  this.goToPage(this.currentPage + 1);
}

prevPage(): void {
  this.goToPage(this.currentPage - 1);
}





editSpace(space: Space): void {
  this.selectedSpaceKey = space.key;
  this.editedSpace = {
    ...space,
    client: space.client ? { ...space.client } : null // Copia completa del espacio y cliente
  };
  this.newSpaceKey = space.key; // Prellenar clave (no editable)

  this.showModal('editSpaceModal');
  console.log('Datos del espacio antes de editar:', this.editedSpace); // Logging para depurar
}


confirmEditSpace(): void {
  console.log('confirmEditSpace ejecutado', { newSpaceKey: this.newSpaceKey, selectedSpaceKey: this.selectedSpaceKey, editedSpace: this.editedSpace });

  if (this.editedSpace) { // Siempre intentar guardar si hay datos
    let hasError = false;
    if (this.newSpaceKey !== this.selectedSpaceKey) { // Validar solo si la clave cambió
      const pattern = /^SUB\d+-[A-Za-z0-9]+$/;
      if (!pattern.test(this.newSpaceKey)) {
        console.log('Patrón inválido');
        alert('La clave debe seguir el patrón SUBN-XXX (donde XXX son letras o números).');
        hasError = true;
      }
    }
    if (!hasError) {
      try {
        console.log('Llamando al servicio editSpace');
        this.autolavadoService.editSpace(this.selectedSpaceKey, this.newSpaceKey, this.editedSpace);
        console.log('Servicio exitoso, actualizando vista');
        this.filterSpaces();
        this.cdr.detectChanges();
        console.log('Vista actualizada, alert mostrado');
        alert('Espacio editado exitosamente!');
      } catch (error) {
        console.error('Error en confirmEditSpace:', error);
        alert('Error al editar espacio: ' + error);
      }
    }
  } else {
    console.log('No hay datos para editar');
  }
  this.hideModal('editSpaceModal');
}


transferSpace0(): void {
  if (confirm(`¿Transferir espacio ${this.selectedSpaceKey} a otro subsuelo?`)) {
    const newSubsuelo = prompt('Ingresa el ID del subsuelo destino (ej. SUB2):', this.subsuelos[0]?.id || '');
    if (newSubsuelo && newSubsuelo !== this.selectedSpace?.subsueloId) {
      try {
        this.autolavadoService.transferSpace(this.selectedSpaceKey, newSubsuelo);
        this.filterSpaces();
        this.cdr.detectChanges();
        alert('Espacio transferido exitosamente!');
      } catch (error) {
        alert('Error al transferir espacio: ' + error);
      }
    }
  }
}

transferSpace(): void {
  if (confirm(`¿Transferir espacio ${this.selectedSpaceKey} a otro subsuelo?`)) {
    const newSubsuelo = prompt('Ingresa el ID del subsuelo destino (ej. SUB2):', '');
    if (newSubsuelo && newSubsuelo !== this.selectedSpace?.subsueloId) {
      try {
        // Transferir localmente (tu lógica actual)
        this.autolavadoService.transferSpace(this.selectedSpaceKey, newSubsuelo);

        // Transferir en backend
        this.autolavadoService.transferSpaceInBackend(this.selectedSpaceKey, newSubsuelo).subscribe({
          next: () => {
            console.log('Espacio transferido en backend');
            this.filterSpaces();
            this.cdr.detectChanges();
            alert('Espacio transferido exitosamente!');
          },
          error: (err) => {
            console.warn('Error transferiendo en backend (funciona offline)', err);
            alert('Transferido localmente. Se sincronizará cuando haya conexión.');
          }
        });
      } catch (error: any) {
        alert('Error al transferir espacio: ' + error.message);
      }
    }
  }
}


openWhatsAppModalOccupied(): void {
  if (this.selectedClient && this.selectedSpace) {
    this.whatsappMessageOccupied = this.autolavadoService.buildWhatsAppMessage(this.selectedClient, this.selectedSpace);
    this.showWhatsAppModalOccupied = true;
  }
}

// Método para cerrar modal WhatsApp
closeWhatsAppModalOccupied(): void {
  this.showWhatsAppModalOccupied = false;
}

// Método para copiar mensaje
copyMessageOccupied(): void {
  navigator.clipboard.writeText(this.whatsappMessageOccupied).then(() => {
    this.hasCopiedMessageOccupied = true;

       const toastEl = document.getElementById('copyToast');
    if (toastEl) {
      const toast = new bootstrap.Toast(toastEl);
      toast.show();
    }
  }).catch(err => {
    console.error('Error copying message:', err);
    // Fallback alert si clipboard falla
    alert('Error al copiar mensaje');
  });


}



}
