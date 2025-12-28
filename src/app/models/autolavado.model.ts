export interface Subsuelo {
  id: string;
  label: string;
}

export interface Space {
  key: string;
  subsueloId: string;
  occupied: boolean;
  hold: boolean;
  clientId: string | null;
  //client: Client | null;
  client?: Client | null;
  startTime: any | null;
  displayName?: string;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  dni?: string;
  phoneIntl: string;
  phoneRaw: string;
  vehicle?: string;
  plate?: string;
  notes?: string;
  spaceKey: string;
  qrText: string;
  category?: string;  // Nueva propiedad opcional
  price?: any;
  vehicleType?: VehicleType | null;
}

export interface QRData {
  t: string;
  client: {
    id: string;
    code: string;
    name: string;
    phone: string;
  };
  space: {
    key: string;
    subsuelo: string;
  };
  start: number;
}

export interface Report {
  id: number;
  timestamp: string;
  totalSpaces: number;
  occupiedSpaces: number;
  freeSpaces: number;
  occupancyRate: number;
  subsueloStats: string; // JSON string
  timeStats: string; // JSON string
  filteredClients: string; // JSON string
}


export interface VehicleType {
  id: number;          // ID generado por la base de datos (Long en backend)
  model: string;       // Ej: "Toyota Corolla Cross"
  category: string;    // Ej: "SUV", "AUTO", "PICKUP", "ALTO PORTE", "MOTO"
  price: number;       // Ej: 40000
}

